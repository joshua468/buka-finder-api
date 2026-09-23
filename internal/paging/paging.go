package paging

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/buka/fooddelivery/internal/response"
	"github.com/gin-gonic/gin"
)

// Query parsing for list endpoints (Task 1, step 3/4):
//   - limit: default 20, max 100. Values above max are CLAMPED, never honored.
//   - offset: default 0. Negative offset -> 400 INVALID_QUERY (clear message).
//   - sort:   field name; unknown field -> 400 INVALID_QUERY (never silently ignored).
//   - order:  asc|desc (default asc when only sort is given).
//
// `allowedSorts` is the whitelist of sortable fields for the endpoint.

var (
	defaultLimit = 20
	maxLimit     = 100
)

// SetDefaults is called once at startup so pagination numbers live in config.
func SetDefaults(dflt, max int) {
	if dflt > 0 {
		defaultLimit = dflt
	}
	if max > 0 {
		maxLimit = max
	}
}

type Query struct {
	Limit     int
	Offset    int
	SortField string // empty = no sort
	Order     string // "asc" | "desc"
}

// Parse reads and validates limit/offset/sort/order query params.
func Parse(c *gin.Context, allowedSorts map[string]bool) (Query, bool) {
	q := Query{Limit: defaultLimit, SortField: "", Order: "asc"}

	if v := c.Query("limit"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n < 0 {
			response.Err(c, 400, response.CodeInvalidQuery, fmt.Sprintf("invalid limit: %q (must be a non-negative integer)", v))
			return q, false
		}
		if n > maxLimit {
			n = maxLimit // clamp, never honor above max
		}
		q.Limit = n
	}

	// page: page-based paging (page = 1-based). offset is derived from it
	// unless an explicit offset is also given (then offset wins).
	if v := c.Query("page"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n < 1 {
			response.Err(c, 400, response.CodeInvalidQuery, fmt.Sprintf("invalid page: %q (must be a positive integer)", v))
			return q, false
		}
		q.Offset = (n - 1) * q.Limit
	}

	if v := c.Query("offset"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n < 0 {
			response.Err(c, 400, response.CodeInvalidQuery, fmt.Sprintf("invalid offset: %q (must be a non-negative integer)", v))
			return q, false
		}
		q.Offset = n
	}

	if v, ok := c.GetQuery("order"); ok {
		o := strings.ToLower(v)
		if o != "asc" && o != "desc" {
			response.Err(c, 400, response.CodeInvalidQuery, fmt.Sprintf("invalid order: %q (must be 'asc' or 'desc')", v))
			return q, false
		}
		q.Order = o
	}

	if f, ok := c.GetQuery("sort"); ok && f != "" {
		if !allowedSorts[f] {
			response.Err(c, 400, response.CodeInvalidQuery, fmt.Sprintf("unknown sort field %q (allowed: %s)", f, sortedKeys(allowedSorts)))
			return q, false
		}
		q.SortField = f
	}

	return q, true
}

// OrderClause returns the GORM ordering clause for the parsed sort, or "".
func (q Query) OrderClause() string {
	if q.SortField == "" {
		return ""
	}
	dir := strings.ToUpper(q.Order)
	return fmt.Sprintf("%s %s", q.SortField, dir)
}

// HasMore reports whether more rows exist beyond the current page.
func (q Query) HasMore(total int) bool {
	return q.Offset+q.Limit < total
}

func sortedKeys(m map[string]bool) string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	for i := range keys {
		for j := i + 1; j < len(keys); j++ {
			if keys[j] < keys[i] {
				keys[i], keys[j] = keys[j], keys[i]
			}
		}
	}
	return strings.Join(keys, ", ")
}