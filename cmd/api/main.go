package main

import (
	"log"
	"net/http"
	"os"
	"path"
	"time"

	"github.com/buka/fooddelivery/internal/config"
	"github.com/buka/fooddelivery/internal/database"
	"github.com/buka/fooddelivery/internal/handlers"
	"github.com/buka/fooddelivery/internal/paging"
	"github.com/buka/fooddelivery/internal/ratelimit"
	"github.com/buka/fooddelivery/internal/response"
	"github.com/gin-gonic/gin"
)

// init pins the process timezone to UTC before anything else runs, so JSON
// timestamps always marshal as "Z" no matter what TZ the host is in.
func init() {
	time.Local = time.UTC
}

var frontendDist = resolveDist()

func resolveDist() string {
	// Find frontend/dist regardless of the process working directory.
	// Order: env override, cwd, repo root relative to this source file.
	if d := os.Getenv("FRONTEND_DIST"); d != "" {
		if fileExists(path.Join(d, "index.html")) {
			return d
		}
	}
	candidates := []string{"frontend/dist"}
	if exe, err := os.Executable(); err == nil {
		dir := path.Dir(exe)
		candidates = append(candidates, path.Join(dir, "frontend/dist"), path.Join(dir, "..", "frontend/dist"), path.Join(dir, "..", "..", "frontend/dist"))
	}
	if wd, err := os.Getwd(); err == nil {
		candidates = append(candidates, path.Join(wd, "frontend/dist"))
	}
	for _, c := range candidates {
		if fileExists(path.Join(c, "index.html")) {
			log.Printf("frontend served from %s", c)
			return c
		}
	}
	return "frontend/dist" // fall back; static 404 only if really absent
}

func fileExists(p string) bool {
	info, err := os.Stat(p)
	return err == nil && !info.IsDir()
}

func main() {
	cfg := config.Load()

	db, err := database.Connect(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("database connection failed: %v", err)
	}

	if err := database.Migrate(db); err != nil {
		log.Fatalf("migration failed: %v", err)
	}
	log.Println("database ready: fooddelivery")

	paging.SetDefaults(cfg.DefaultLimit, cfg.MaxLimit)

	r := gin.New()
	r.Use(gin.Logger(), gin.Recovery())
	r.Use(corsMiddleware(cfg.CORSOrigins))
	if cfg.RateLimitOn {
		rl := ratelimit.New(cfg.RateLimitRPM, cfg.RateLimitBust)
		r.Use(rl.Handler())
	}

	v1 := r.Group("/api/v1")

	v1.GET("/restaurants", handlers.ListRestaurants)
	v1.GET("/restaurants/:id", handlers.GetRestaurant)
	v1.GET("/restaurants/:id/menu", handlers.ListRestaurantMenu)

	v1.GET("/customers", handlers.ListCustomers)
	v1.GET("/customers/:id", handlers.GetCustomer)

	v1.GET("/orders", handlers.ListOrders)
	v1.GET("/orders/:id", handlers.GetOrder)
	v1.POST("/orders", handlers.CreateOrder)
	v1.PATCH("/orders/:id", handlers.UpdateOrder)
	v1.DELETE("/orders/:id", handlers.DeleteOrder)

	r.NoRoute(func(c *gin.Context) {
		// Serve the built frontend (frontend/dist) from the API origin so the
		// consumer and API share one base URL and /api/v1 stays same-origin.
		if c.Request.Method == http.MethodGet {
			p := path.Join(frontendDist, c.Request.URL.Path)
			if fileExists(p) {
				c.File(p)
				return
			}
			if fileExists(path.Join(frontendDist, "index.html")) {
				c.File(path.Join(frontendDist, "index.html"))
				return
			}
		}
		response.Err(c, http.StatusNotFound, response.CodeResourceNotFound, "resource not found")
	})

	log.Printf("food delivery API running on :%s", cfg.Port)
	if err := r.Run(":" + cfg.Port); err != nil {
		log.Fatalf("server failed: %v", err)
	}
}

func corsMiddleware(origins []string) gin.HandlerFunc {
	allowed := map[string]bool{}
	for _, o := range origins {
		allowed[o] = true
	}
	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		if allowed[origin] {
			c.Header("Access-Control-Allow-Origin", origin)
			c.Header("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
			c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization")
			c.Header("Vary", "Origin")
		}
		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}