type NewspaperModel = {
    "uuid": string;
    "enable": boolean;
    "createdAt": Date | null;
};

type ThreadModel = {
    "uuid": string;
    "title": string;
    "summary": string | null;
    "enable": boolean;
};

type PostModel = {
    userName: string;
    post: string;
    createdAt: Date;
};

type FormatDatePostModel = {
    userName: string;
    post: string;
    createdAt: string;
};

type RegisterPostModel = {
    threadId: string;
    userName: string | null;
    post: string;
    createdAt: Date;
};

export type { FormatDatePostModel, NewspaperModel, PostModel, RegisterPostModel, ThreadModel };
