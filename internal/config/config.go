package config

import (
	"os"
	"strconv"
	"strings"
)

// Config holds every tunable value. All numbers that the task says must live
// in config (rate limit, pagination defaults) live here — never in handlers.
type Config struct {
	Port          string
	DatabaseURL   string
	CORSOrigins   []string
	RateLimitOn   bool
	RateLimitRPM  int // requests per minute per IP
	RateLimitBust int // burst allowance
	DefaultLimit  int
	MaxLimit      int
}

func Load() Config {
	return Config{
		Port:          env("PORT", "8000"),
		DatabaseURL:   env("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/fooddelivery?sslmode=disable"),
		CORSOrigins:   envList("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173,http://localhost:8000"),
		RateLimitOn:   envBool("RATE_LIMIT_ENABLED", true),
		RateLimitRPM:  envInt("RATE_LIMIT_LIMIT", 100),
		RateLimitBust: envInt("RATE_LIMIT_BURST", 150),
		DefaultLimit:  envInt("PAGINATION_DEFAULT_LIMIT", 20),
		MaxLimit:      envInt("PAGINATION_MAX_LIMIT", 100),
	}
}

func env(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}

func envInt(k string, def int) int {
	if v := os.Getenv(k); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return def
}

func envBool(k string, def bool) bool {
	if v := os.Getenv(k); v != "" {
		if b, err := strconv.ParseBool(v); err == nil {
			return b
		}
	}
	return def
}

func envList(k, def string) []string {
	parts := strings.Split(env(k, def), ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if p = strings.TrimSpace(p); p != "" {
			out = append(out, p)
		}
	}
	return out
}