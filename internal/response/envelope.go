package response

import (
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// Envelope shapes (Task 1, step 3): every response is one of these two
// shapes, and only these two. All JSON keys are snake_case.
//
// Success: { "success": true, "data": ..., "meta": { "timestamp": ... } }
// List:    { "success": true, "data": [...], "meta": { total, limit, offset, hasMore, timestamp } }
// Error:   { "success": false, "data": null, "error": { code, message }, "meta": { timestamp, request_id } }

// Meta is the pagination metadata on success/list responses.
type Meta struct {
	Total     int    `json:"total"`
	Limit     int    `json:"limit"`
	Offset    int    `json:"offset"`
	HasMore   bool   `json:"hasMore"`
	Timestamp string `json:"timestamp,omitempty"`
}

// ResourceMeta is the metadata on single-resource success responses: just the
// audit timestamp. It deliberately does not include pagination fields.
type ResourceMeta struct {
	Timestamp string `json:"timestamp"`
}

// ErrorMeta is the metadata on error responses: just the log/audit fields.
type ErrorMeta struct {
	Timestamp string `json:"timestamp"`
	RequestID string `json:"request_id"`
}

type ErrorBody struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

type Body struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data"`
	Meta    interface{} `json:"meta,omitempty"`
	Error   *ErrorBody  `json:"error,omitempty"`
}

// Error codes — Task 1 step 3/4: honest status codes (400, 404, 409, 422, 429).
const (
	CodeInvalidRequest   = "INVALID_REQUEST"
	CodeInvalidQuery     = "INVALID_QUERY"
	CodeValidationError  = "VALIDATION_ERROR"
	CodeResourceNotFound = "RESOURCE_NOT_FOUND"
	CodeConflict         = "CONFLICT"
	CodeRateLimited      = "RATE_LIMITED"
	CodeInternalError    = "INTERNAL_ERROR"
)

func timestamp() string {
	return time.Now().UTC().Format(time.RFC3339)
}

// OK writes a single-resource success envelope.
func OK(c *gin.Context, status int, data interface{}) {
	c.JSON(status, Body{Success: true, Data: data, Meta: &ResourceMeta{Timestamp: timestamp()}})
}

// List writes the paginated success envelope.
func List(c *gin.Context, status int, data interface{}, meta Meta) {
	meta.Timestamp = timestamp()
	c.JSON(status, Body{Success: true, Data: data, Meta: &meta})
}

// Err writes an error envelope with the honest HTTP status.
func Err(c *gin.Context, status int, code, message string) {
	c.JSON(status, Body{
		Success: false,
		Data:    nil,
		Error:   &ErrorBody{Code: code, Message: message},
		Meta:    &ErrorMeta{Timestamp: timestamp(), RequestID: uuid.NewString()},
	})
}