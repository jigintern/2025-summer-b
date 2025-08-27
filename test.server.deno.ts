import { Hono } from "https://deno.land/x/hono@v4.3.11/mod.ts";
import { serveStatic } from "https://deno.land/x/hono@v4.3.11/middleware.ts";
import { getThreadTitles } from "./api/threadList.ts";
import { createThreadPosts, getThreadPosts } from "./api/threadContent.ts";
import { createThreadSummary } from "./api/newspaperContent.ts";

// Honoアプリケーションの初期化
const app = new Hono();

// スレッドタイトル取得API
app.get("/thread-titles", getThreadTitles);
// スレッド投稿取得API
app.get("/thread-posts", getThreadPosts);

// テスト用データ作成API
app.get("/create-posts", createThreadPosts);

// スレッド要約API
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
