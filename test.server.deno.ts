import { Hono } from "https://deno.land/x/hono@v4.3.11/mod.ts";
import { serveStatic } from "https://deno.land/x/hono@v4.3.11/middleware.ts";
import { getThreadTitles } from "./api/threadList.ts";
import { createThreadPosts, getThreadPosts } from "./api/threadContent.ts";
import { createThreadSummary } from "./api/newspaperContent.ts";

const app = new Hono();

/**
 * スレッドのタイトル一覧を取得するAPI
 */
app.get("/thread-titles", getThreadTitles);
// スレッド投稿取得API

/**
 * スレッドの投稿一覧を取得するAPI
 * @property threadId - スレッドが持っているUUID
 */
app.get("/thread-posts", getThreadPosts);

// テスト用データ作成API

/**
 * テスト用のダミー投稿データを作成するAPI
 * @property newspaperId - 新聞が持っているUUID
 * @property index - ダミー投稿を作成したいスレッドの新聞内のスレッド番号(リストの順番)(0 ~ 4)
 */
app.get("/create-posts", createThreadPosts);

/**
 * スレッドの投稿内容を新聞の記事風に要約生成するAPI
 * @property newspaperId - 新聞が持っているUUID
 * @property index - 投稿要約を作成したいスレッドの新聞内のスレッド番号(リストの順番)(0 ~ 4)
 */
app.post("/thread-summary", createThreadSummary);

// 静的ファイル配信
app.get(
    "*",
    serveStatic({
        root: "./public",
        rewriteRequestPath: (path) => {
            if (path === "/") {
                return "/index.html";
            }
            if (!path.includes(".")) {
                return `${path}.html`;
            }
            return path;
        },
    }),
);

Deno.serve(app.fetch);
