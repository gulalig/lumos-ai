import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { Redis } from "ioredis";

// Uses only unique short-lived keys, never a meeting key, FLUSH*, KEYS or SCAN.
// Requires explicitly supplied REDIS_URL; deliberately does not load .env.
export async function checkRedisCompatibility(redisUrl) {
  let endpoint;
  try {
    endpoint = new URL(redisUrl);
  } catch {
    throw new Error("REDIS_URL must be a native Redis URL");
  }
  if (!["redis:", "rediss:"].includes(endpoint.protocol))
    throw new Error("Use the native Redis endpoint, not the REST API");
  const prefix = "lumos:compat:" + randomUUID() + ":";
  const [value, hash, stream, counter, checkpoint] = [
    "value",
    "hash",
    "stream",
    "counter",
    "checkpoint",
  ].map((name) => prefix + name);
  const keys = [value, hash, stream, counter, checkpoint];
  const client = new Redis(redisUrl, {
    lazyConnect: true,
    connectTimeout: 5000,
    commandTimeout: 10000,
    maxRetriesPerRequest: 1,
    retryStrategy: () => null,
    ...(endpoint.protocol === "rediss:"
      ? { tls: { minVersion: "TLSv1.2" } }
      : {}),
  });
  // Suppress raw connection errors: URL/credentials must never enter logs.
  client.on("error", () => {});
  const passed = [];
  async function check(name, action) {
    try {
      await action();
      passed.push(name);
    } catch {
      throw new Error("Redis compatibility check failed: " + name);
    }
  }
  try {
    await check("CONNECT/PING", async () => {
      await client.connect();
      assert.equal(await client.ping(), "PONG");
    });
    await check("SET NX PX / PSETEX / GET / TTL / PTTL / PEXPIRE", async () => {
      assert.equal(await client.set(value, "fixture", "PX", 60000, "NX"), "OK");
      assert.equal(await client.get(value), "fixture");
      await client.psetex(checkpoint, 60000, "fixture");
      assert.ok((await client.ttl(value)) > 0);
      assert.ok((await client.pttl(value)) > 0);
      assert.equal(await client.pexpire(value, 60000), 1);
    });
    await check(
      "HSET / HGET / HGETALL / HINCRBY / EXISTS / TYPE / EXPIRE",
      async () => {
        await client.hset(hash, "status", "open");
        await client.expire(hash, 60);
        assert.equal(await client.hget(hash, "status"), "open");
        assert.equal((await client.hgetall(hash)).status, "open");
        assert.equal(await client.hincrby(hash, "epoch", 1), 1);
        assert.equal(await client.exists(hash), 1);
        assert.equal(await client.type(hash), "hash");
      },
    );
    let id;
    await check(
      "XGROUP CREATE MKSTREAM / XADD / XREAD BLOCK / XRANGE / XREVRANGE",
      async () => {
        await client.xgroup("CREATE", stream, "compat", "0", "MKSTREAM");
        await client.pexpire(stream, 60000);
        id = await client.xadd(stream, "*", "fixture", "one");
        assert.equal(
          (
            await client.xread("COUNT", 1, "BLOCK", 100, "STREAMS", stream, "0")
          )[0][1][0][0],
          id,
        );
        assert.equal(
          (await client.xrange(stream, "-", "+", "COUNT", 1))[0][0],
          id,
        );
        assert.equal(
          (await client.xrevrange(stream, "+", "-", "COUNT", 1))[0][0],
          id,
        );
      },
    );
    await check(
      "XREADGROUP BLOCK / XPENDING / XINFO GROUPS / XAUTOCLAIM / XACK",
      async () => {
        assert.ok(
          await client.xreadgroup(
            "GROUP",
            "compat",
            "first",
            "COUNT",
            1,
            "BLOCK",
            100,
            "STREAMS",
            stream,
            ">",
          ),
        );
        assert.equal((await client.xpending(stream, "compat"))[0], 1);
        assert.equal(
          (await client.xpending(stream, "compat", "-", "+", 1))[0][0],
          id,
        );
        const groups = await client.xinfo("GROUPS", stream);
        assert.ok(groups.length);
        assert.ok(groups[0].includes("lag"));
        assert.equal(
          (
            await client.xautoclaim(
              stream,
              "compat",
              "second",
              0,
              "0-0",
              "COUNT",
              1,
            )
          )[1][0][0],
          id,
        );
        assert.equal(await client.xack(stream, "compat", id), 1);
      },
    );
    await check(
      "EVAL multi-key atomic checkpoint + XADD + XACK / INCR",
      async () => {
        const pending = await client.xadd(stream, "*", "fixture", "two");
        await client.xreadgroup(
          "GROUP",
          "compat",
          "second",
          "COUNT",
          1,
          "STREAMS",
          stream,
          ">",
        );
        const result = await client.eval(
          'assert(redis.call("TYPE",KEYS[3]).ok=="hash"); ' +
            'local pending=redis.call("XPENDING",KEYS[4],ARGV[1],ARGV[2],ARGV[2],1); assert(#pending==1); ' +
            'local n=redis.call("INCR",KEYS[1]); redis.call("PEXPIRE",KEYS[1],60000); ' +
            'redis.call("SET",KEYS[2],"checkpoint","PX",60000); ' +
            'redis.call("HSET",KEYS[3],"status","resolved"); ' +
            'redis.call("XADD",KEYS[4],"*","fixture","three"); ' +
            'return redis.call("XACK",KEYS[4],ARGV[1],ARGV[2])',
          4,
          counter,
          checkpoint,
          hash,
          stream,
          "compat",
          pending,
        );
        assert.equal(result, 1);
        assert.equal(await client.get(checkpoint), "checkpoint");
        await assert.rejects(
          client.eval('return redis.error_reply("LUMOS_COMPAT_EXPECTED")', 0),
          /LUMOS_COMPAT_EXPECTED/,
        );
      },
    );
    await check("pipeline / MULTI EXEC transaction", async () => {
      for (const pipeline of [client.pipeline(), client.multi()]) {
        const results = await pipeline
          .set(value, "pipeline", "PX", 60000)
          .get(value)
          .exec();
        assert.ok(results.every(([error]) => !error));
        assert.equal(results[1][1], "pipeline");
      }
    });
    await check("DEL isolated keys", async () => {
      await client.del(...keys);
    });
    return passed;
  } finally {
    // Failure cleanup is bounded and limited to these UUID-scoped fixture keys.
    try {
      if (client.status === "ready") await client.del(...keys);
    } catch {
      /* TTL bounds residue */
    }
    client.disconnect();
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  checkRedisCompatibility(process.env.REDIS_URL).then(
    (passed) => console.log("Redis compatibility PASS:\n" + passed.join("\n")),
    (error) => {
      console.error(error.message);
      process.exitCode = 1;
    },
  );
}
