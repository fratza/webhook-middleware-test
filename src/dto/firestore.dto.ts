/**
 * Data Transfer Objects for Firestore service responses
 */

/**
 * Error response type
 */
export type ErrorResponse = {
    error: string;
};

/**
 * Standard response format
 */
export type StandardResponse = {
    uid: string;
    Title: string;
    Location: string;
    Date: string;
    Description: string;
    ImageUrl: string[];
    Link: string;
};

/**
 * Custom response format that extends the standard format
 */
export type CustomResponse = StandardResponse & {
    Logo: string;
    Sports: string;
    Score: string;
    EventDate: string;
    EventEndDate: string;
};
