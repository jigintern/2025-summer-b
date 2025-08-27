type NewspaperModel = {
    "uuid": string;
    "enable": boolean;
    "createdAt": Date | null;
};

type ThreadModel = {
    "uuid": string;
    "title": string;
    "summary": string | null;
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

export type { FormatDatePostModel, NewspaperModel, PostModel, ThreadModel };
