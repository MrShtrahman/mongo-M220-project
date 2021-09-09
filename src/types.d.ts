declare global {
    interface DALResponse {
        success?: boolean;
        error?: string | unknown;
    }
}

export {}