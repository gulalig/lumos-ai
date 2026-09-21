package meetinglease

const acquireScript = `
if redis.call("EXISTS", KEYS[1]) == 1 then
	return 0
end

local fence =
	redis.call(
		"INCR",
		KEYS[2]
	)

redis.call(
	"PSETEX",
	KEYS[1],
	ARGV[2],
	ARGV[1]
)

return fence
`

const renewScript = `
local current =
	redis.call(
		"GET",
		KEYS[1]
	)

if current ~= ARGV[1] then
	return 0
end

redis.call(
	"PEXPIRE",
	KEYS[1],
	ARGV[2]
)

return 1
`

const releaseScript = `
local current =
	redis.call(
		"GET",
		KEYS[1]
	)

if current ~= ARGV[1] then
	return 0
end

redis.call(
	"DEL",
	KEYS[1]
)

return 1
`
