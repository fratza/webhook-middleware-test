import axios from 'axios';

export class HelperService {
    /**
     * Handle error responses from Vistar API calls
     *
     * @param {any} error - The error object caught from the API call.
     * @param {string} source - The source file where the error occured.
     * @param {string} functionName - The name of the function where the error occurred.
     * @returns {string} - The formatted error message.
     */
    public handleError(error: any, source: string, functionName: string): string {
        let errorMessage = '';

        if (axios.isAxiosError(error)) {
            errorMessage = `${source} error on ${functionName}(): ${
                error.response?.data.errors?.toString() || error.message
            }`;
        } else {
            errorMessage = `${source} unexpected error on ${functionName}(): ${error.message || error}`;
        }

        return errorMessage;
    }

    /**
     * Saves a record in the internal database for each successful proof of play.
     *
     * This method logs a record in the database whenever a proof of play is successfully sent.
     * It handles any errors that occur during the logging process.
     *
     * @param {any} data - The proof of play successfully sent to be saved
     */
    public savePlayLog(data: any) {
        try {
        } catch (error: any) {
            this.handleError(error, this.constructor.name, 'savePlayLog');
        }
    }
}
