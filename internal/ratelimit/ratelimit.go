package ratelimit

import (
	"fmt"
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/buka/fooddelivery/internal/response"
	"github.com/gin-gonic/gin"
	"golang.org/x/time/rate"
)

// Middleware returns a Gin middleware that limits each client IP to
// `limit` requests per `window` (100/min default), with a burst allowance.
// Exceeded requests get 429 RATE_LIMITED with a Retry-After header (Task 1
// step 5). Numbers live in config, never in the handler.

type Middleware struct {
	mu       sync.Mutex
	clients  map[string]*clientBucket
	limit    rate.Limit
	burst    int
}

type clientBucket struct {
	limiter *rate.Limiter
	last    time.Time
}

func New(requestsPerMinute, burst int) *Middleware {
	if requestsPerMinute < 1 {
		requestsPerMinute = 1
	}
	if burst < 1 {
		burst = requestsPerMinute
	}
	return &Middleware{
		clients: map[string]*clientBucket{},
		limit:   rate.Every(time.Minute / time.Duration(requestsPerMinute)),
		burst:   burst,
	}
}

func (m *Middleware) Handler() gin.HandlerFunc {
	return func(c *gin.Context) {
		ip := c.ClientIP()
		limiter := m.getLimiter(ip)

		if !limiter.Allow() {
			retryAfter := m.retryAfter(limiter)
			c.Header("Retry-After", retryAfter)
			response.Err(c, http.StatusTooManyRequests, response.CodeRateLimited,
				"rate limit exceeded, retry later")
			c.Abort()
			return
		}
		// expose what's left so clients can back off predictably
		c.Header("X-RateLimit-Remaining", fmtRemaining(limiter))
		c.Next()
	}
}

func (m *Middleware) getLimiter(ip string) *rate.Limiter {
	m.mu.Lock()
	defer m.mu.Unlock()
	b, ok := m.clients[ip]
	if !ok {
		// prune stale buckets periodically to avoid unbounded memory
		if len(m.clients) > 10000 {
			now := time.Now()
			for k, v := range m.clients {
				if now.Sub(v.last) > 2*time.Minute {
					delete(m.clients, k)
				}
			}
		}
		b = &clientBucket{limiter: rate.NewLimiter(m.limit, m.burst), last: time.Now()}
		m.clients[ip] = b
		return b.limiter
	}
	b.last = time.Now()
	return b.limiter
}

// retryAfter returns whole seconds a client should wait.
func (m *Middleware) retryAfter(l *rate.Limiter) string {
	r := l.Reserve()
	if !r.OK() {
		return "60"
	}
	d := r.Delay()
	r.Cancel() // we're not consuming the reservation
	if d <= 0 {
		return "1"
	}
	return strconv.Itoa(int(d.Seconds()) + 1)
}

func fmtRemaining(l *rate.Limiter) string {
	return fmt.Sprintf("%d", int(l.Tokens()))
}