import { Context, Hono } from "https://deno.land/x/hono@v4.3.11/mod.ts";
import { serveStatic } from "https://deno.land/x/hono@v4.3.11/middleware.ts";
import { getThreadTitles } from "./api/threadList.ts";
import {
    createThreadPosts,
    getThreadPosts,
    getWebSocketThreadPosts,
    postAndGetUserPost,
} from "./api/threadContent.ts";
import { createThreadSummary } from "./api/newspaperContent.ts";

const app = new Hono();

/**
 * スレッドのタイトル一覧を取得するAPI
 */
app.get("/thread-titles", getThreadTitles);

/**
 * スレッドの投稿一覧を取得するAPI
 * @property thread-id - スレッドが持っているUUID
 */
app.get("/thread-posts", getThreadPosts);

/**
 * 新しい投稿を作成するAPI
 * @property thread-id - スレッドが持っているUUID
 * @property user-id - 投稿するユーザの名前
 * @property post-content - 投稿内容
 */
app.get("/new-posts");

/**
 * テスト用のダミー投稿データを作成するAPI
 * @property newspaper-id - 新聞が持っているUUID
 * @property index - ダミー投稿を作成したいスレッドの新聞内のスレッド番号(リストの順番)(0 ~ 4)
 */
app.get("/create-posts", createThreadPosts);

/**
 * スレッドの投稿内容を新聞の記事風に要約生成するAPI
 * @property newspaperId - 新聞が持っているUUID
 * @property index - 投稿要約を作成したいスレッドの新聞内のスレッド番号(リストの順番)(0 ~ 4)
 */
app.post("/thread-summary", createThreadSummary);

// WebSocket処理
app.get("/ws/post", (ctx: Context) => {
    const upgradeHeader = ctx.req.header("Upgrade");
    if (upgradeHeader !== "websocket") {
        // WebSocketでなければ、適切なHTTPレスポンスを返す
        return ctx.text("Expected a WebSocket upgrade request.", 426);
    }
    const sockets = new Set<WebSocket>();
    const threadId: string | undefined = ctx.req.query("thread-id");
    if (!threadId) {
        return ctx.text("Missing thread-id parameter", 400);
    }

    // Denoの標準APIを使ってWebSocketにアップグレード
    const { response, socket } = Deno.upgradeWebSocket(ctx.req.raw);

    // WebSocketでclientからリクエストされたとき
    socket.onopen = () => {
        sockets.add(socket);
        socket.send(JSON.stringify(getWebSocketThreadPosts(threadId)));
        console.log("connection opened");
    };

    // clientからメッセージを受け取ったとき
    socket.onmessage = (event: MessageEvent) => {
        try {
            const data = JSON.parse(event.data);
            postAndGetUserPost(data, socket, sockets);
        } catch (e) {
            console.error("Failed to parse message:", e);
        }
    };

    // websocketのconnectionを終了するとき
    socket.onclose = () => {
        sockets.delete(socket);
        console.log("Connection closed");
    };

    // errorが出たとき
    socket.onerror = (error: Event) => {
        console.error("WebSocket error", error);
    };

    // Honoハンドラからは、アップグレード用のResponseオブジェクトを返す
    return response;
});

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

Deno.serve({ port: 8000 }, app.fetch);
