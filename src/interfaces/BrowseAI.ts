export interface TaskData {
    id: string;
    capturedTexts?: any;
    capturedScreenshots?: any;
    capturedLists?: any;
    originUrl?: string;
    inputParameters?: any;
}

export interface BrowseAIWebhookData {
    task: TaskData;
}
