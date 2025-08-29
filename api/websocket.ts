import { Context } from "https://deno.land/x/hono@v4.3.11/mod.ts";
import { ThreadModel } from "./models.ts";
import { getWebSocketThreadPosts, postAndGetUserPost } from "./threadContent.ts";
import kv from "./lib/kv.ts";

const threadSockets = new Map<string, Set<WebSocket>>();

const getThreadData = async (ws: WebSocket, newspaperId: string, index: number) => {
    const threadData: Deno.KvEntryMaybe<ThreadModel> = await kv.get<ThreadModel>([
        newspaperId,
        index,
    ]);
    if (!threadData.value) {
        console.error(
            `Thread data not found for newspaperId: ${newspaperId}, index: ${index}`,
        );

        ws.send(JSON.stringify({
            type: "error",
            message: "スレッドが見つかりませんでした。",
        }));

        ws.close(1008, "Thread not found");
        return;
    }
    return threadData.value;
};

export const websocketPost = (ctx: Context) => {
    const upgradeHeader = ctx.req.header("Upgrade");
    if (upgradeHeader !== "websocket") {
        // WebSocketでなければ、適切なHTTPレスポンスを返す
        return ctx.text("Expected a WebSocket upgrade request.", 426);
    }
    const newspaperId: string | undefined = ctx.req.query("newspaper-id");
    const index: string | undefined = ctx.req.query("index");
    const threadId: string | undefined = ctx.req.query("thread-id");
    if (!newspaperId || !index) {
        return ctx.text("missing newspaper-id or index parameter", 400);
    }
    const threadIndex: number = Number(index);
    if (!threadId) {
        return ctx.text("Missing thread-id parameter", 400);
    }

    // Denoの標準APIを使ってWebSocketにアップグレード
    const { response, socket } = Deno.upgradeWebSocket(ctx.req.raw);

    // WebSocketでclientからリクエストされたとき
    socket.onopen = async () => {
        const threadData: ThreadModel | undefined = await getThreadData(
            socket,
            newspaperId,
            threadIndex,
        );
        if (!threadData) {
            return;
        }
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
        const posts = await getWebSocketThreadPosts(threadData.uuid);
        socket.send(JSON.stringify({ type: "start", thread: threadData, posts: posts }));
    };

    // clientからメッセージを受け取ったとき
    socket.onmessage = (event: MessageEvent) => {
        try {
            const data = JSON.parse(event.data);
            const socketsForThread = threadSockets.get(threadId);
            if (socketsForThread) {
                postAndGetUserPost(
                    threadId,
                    newspaperId,
                    threadIndex,
                    data,
                    socket,
                    socketsForThread,
                );
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
};
