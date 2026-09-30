package redisclient

import "testing"

func TestNativeRedisTLSAndSecretSafeErrors(t *testing.T) {
	client, err := New("rediss://fixture:fixture@redis.example.com:6379")
	if err != nil {
		t.Fatal(err)
	}
	defer client.Close()
	options := client.client.Options()
	if options.TLSConfig == nil || options.TLSConfig.InsecureSkipVerify || options.Protocol != 2 || !options.DisableIdentity {
		t.Fatal("native TLS / RESP2 settings incorrect")
	}
	if _, err := New("fixture-secret"); err == nil || err.Error() != "REDIS_URL must be a valid native Redis URL" {
		t.Fatal("invalid Redis URL error must not contain credentials")
	}
}
