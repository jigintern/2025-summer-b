type NewspaperModel = {
    uuid: string;
    enable: boolean;
    createdAt: Date | null;
};

type DateStringNewspaperModel = {
    uuid: string;
    enable: boolean;
    createdAt: string;
};

type ThreadModel = {
    uuid: string;
    title: string;
    enable: boolean;
    summary: string | null;
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

type ThreadData = {
    threadId: string;
    title: string;
    summary: string | null;
};

export type {
    DateStringNewspaperModel,
    FormatDatePostModel,
    NewspaperModel,
    PostModel,
    RegisterPostModel,
    ThreadData,
    ThreadModel,
};
