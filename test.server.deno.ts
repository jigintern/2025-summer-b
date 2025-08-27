import { Context, Hono } from "https://deno.land/x/hono@v4.3.11/mod.ts";
import { logger, serveStatic } from "https://deno.land/x/hono@v4.3.11/middleware.ts";
import { getThreadTitles } from "./api/threadList.ts";
import {
    createThreadPosts,
    getThreadPosts,
    getWebSocketThreadPosts,
    postAndGetUserPost,
} from "./api/threadContent.ts";
import { createThreadSummary } from "./api/newspaperContent.ts";

const app = new Hono();

app.use("*", logger());

/**
 * スレッドのタイトル一覧を取得するAPI
 */
app.get("/thread-titles", getThreadTitles);

/**
 * スレッドの投稿一覧を取得するAPI
 * @param thread-id - スレッドが持っているUUID
 */
app.get("/thread-posts", getThreadPosts);

/**
 * 新しい投稿を作成するAPI
 * @param thread-id - スレッドが持っているUUID
 * @param user-id - 投稿するユーザの名前
 * @param post-content - 投稿内容
 */
app.get("/new-posts");

/**
 * テスト用のダミー投稿データを作成するAPI
 * @param newspaper-id - 新聞が持っているUUID
 * @param index - ダミー投稿を作成したいスレッドの新聞内のスレッド番号(リストの順番)(0 ~ 4)
 */
app.get("/create-posts", createThreadPosts);

/**
 * スレッドの投稿内容を新聞の記事風に要約生成するAPI
 * @param newspaperId - 新聞が持っているUUID
 * @param index - 投稿要約を作成したいスレッドの新聞内のスレッド番号(リストの順番)(0 ~ 4)
 */
app.post("/thread-summary", createThreadSummary);

const threadSockets = new Map<string, Set<WebSocket>>();
/**
 * WebSocket接続を行い、スレッド内の投稿を反映する
 * @param thread-id - スレッドが持っているUUID
 */
app.get("/ws", (ctx: Context) => {
    const upgradeHeader = ctx.req.header("Upgrade");
    if (upgradeHeader !== "websocket") {
        // WebSocketでなければ、適切なHTTPレスポンスを返す
        return ctx.text("Expected a WebSocket upgrade request.", 426);
    }
    const threadId: string | undefined = ctx.req.query("thread-id");
    if (!threadId) {
        return ctx.text("Missing thread-id parameter", 400);
    }

    // Denoの標準APIを使ってWebSocketにアップグレード
    const { response, socket } = Deno.upgradeWebSocket(ctx.req.raw);

    // WebSocketでclientからリクエストされたとき
    socket.onopen = async () => {
        let sockets = threadSockets.get(threadId);
        if (!sockets) {
            sockets = new Set<WebSocket>();
            threadSockets.set(threadId, sockets);
        }
        sockets.add(socket);
        console.log(
            `Connection opened for thread: ${threadId}. Total connections for this thread: ${sockets.size}`,
        );

        // 接続時にスレッドの投稿リストを取得してクライアントに送信
        const posts = await getWebSocketThreadPosts(threadId);
        socket.send(JSON.stringify({ type: "start", posts: posts }));
    };

    // clientからメッセージを受け取ったとき
    socket.onmessage = (event: MessageEvent) => {
        try {
            const data = JSON.parse(event.data);
            const socketsForThread = threadSockets.get(threadId);
            if (socketsForThread) {
                postAndGetUserPost(data, socket, socketsForThread);
            }
        } catch (e) {
            console.error("Failed to parse message:", e);
        }
    };

    // websocketのconnectionを終了するとき
    socket.onclose = () => {
        const sockets = threadSockets.get(threadId);
        if (sockets) {
            sockets.delete(socket);
            console.log(
                `Connection closed for thread: ${threadId}. Remaining connections: ${sockets.size}`,
            );
            // このスレッドの接続が0になったら、Mapからキーごと削除
            if (sockets.size === 0) {
                threadSockets.delete(threadId);
                console.log(`Thread ${threadId} removed from map.`);
            }
        }
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
