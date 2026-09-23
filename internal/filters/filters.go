package filters

import (
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// Builder collects query params into GORM where clauses.
// Filters are AND'd across fields; repeated values for one field are OR'd
// (IN). Unknown fields and empty values are ignored.
type Builder struct {
	values map[string][]string
}

func New() *Builder {
	return &Builder{values: map[string][]string{}}
}

// Values returns the cleaned values for a filter param, honoring both the
// flat (?status=a&status=b) and bracket (filter[status]=a) syntaxes. Values
// from both styles are unioned; empty strings are dropped.
func Values(c *gin.Context, param string) []string {
	var out []string
	for _, key := range []string{param, "filter[" + param + "]"} {
		if vals, ok := c.GetQueryArray(key); ok {
			for _, v := range vals {
				if v != "" {
					out = append(out, v)
				}
			}
		}
	}
	return out
}

// Add records a filter param. Repeated occurrences are collected. Empty or
// missing values are dropped.
func (b *Builder) Add(c *gin.Context, param string) *Builder {
	if vals := Values(c, param); len(vals) > 0 {
		b.values[param] = append(b.values[param], vals...)
	}
	return b
}

// Apply turns recorded filters into a GORM chain. col maps a query param name
// to the DB column it filters on; params not in the map are ignored.
func (b *Builder) Apply(db *gorm.DB, col map[string]string) *gorm.DB {
	for param, vals := range b.values {
		if column, ok := col[param]; ok {
			db = db.Where(column+" IN ?", vals)
		}
	}
	return db
}

// ApplyRange turns recorded filters into >= comparisons. col maps a param name
// to the DB column; each value adds an ANDed `column >= value` condition.
// Params already handled by Apply (IN) must not also appear here.
func (b *Builder) ApplyRange(db *gorm.DB, col map[string]string) *gorm.DB {
	for param, vals := range b.values {
		if column, ok := col[param]; ok {
			for _, v := range vals {
				if v != "" {
					db = db.Where(column+" >= ?", v)
				}
			}
		}
	}
	return db
}