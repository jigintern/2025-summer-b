// --- 1. URLからパラメータを取得 ---
const queryString = globalThis.location.search;
const params = new URLSearchParams(queryString);
const title = params.get("title");
const threadId = params.get("thread-id");

// --- 2. HTML要素を取得 ---
const titleElement = document.getElementById("title");
const postsContainer = document.getElementById("posts");
const userNameInput = document.getElementById("userName");
const postContentInput = document.getElementById("postContent");
const submitBtn = document.getElementById("submitBtn");

// --- 3. ページタイトルを設定 ---
titleElement.textContent = title ? title : "掲示板";

// --- 4. WebSocket接続を確立 ---
const wsProtocol = location.protocol === "https:" ? "wss" : "ws";
const ws = new WebSocket(
    `${wsProtocol}://${location.host}/ws?thread-id=${threadId}`,
);

// --- 5. WebSocketのイベントハンドラを設定 ---

ws.onopen = () => {
    console.log("WebSocket接続成功");
};

// メッセージ受信時の処理
ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log("サーバーから受信:", data); // デバッグ用にコンソールに出力

    // サーバーからの初期データを受信した場合
    if (data.type === "start") {
        renderInitialPosts(data.posts);
    } // 新しい投稿がブロードキャストされてきた場合 (サーバー側の実装に依存)
    else if (data.type === "new_post") {
        appendPost(data.post);
    } // エラーメッセージを受信した場合
    else if (data.type === "error") {
        alert(data.message);
    }
};

// 接続が切れたときの処理
ws.onclose = () => {
    console.log("WebSocket接続が切れました。");
    // submitBtn.disabled = true; // 送信ボタンを無効化
    // submitBtn.textContent = "切断されました";
};

// エラー発生時の処理
ws.onerror = (e) => {
    console.error("WebSocketエラー", e);
};

// --- 6. 描画関連の関数 ---

// 投稿リストを初期描画する関数
function renderInitialPosts(posts) {
    postsContainer.innerHTML = ""; // いったん中身をクリア
    if (!posts || posts.length === 0) {
        postsContainer.innerHTML = "<p>まだ投稿はありません。</p>";
        return;
    }
    console.log(posts);
    posts.forEach(appendPost);
}

// ひとつの投稿をリストの末尾に追加する関数
function appendPost(post) {
    console.log("post", post);
    const postDiv = document.createElement("div");
    postDiv.className = "post";

    const mainContentDiv = document.createElement("div");

    const userDiv = document.createElement("div");
    userDiv.className = "user";
    userDiv.textContent = post.userName;

    const contentDiv = document.createElement("div");
    contentDiv.className = "content";
    contentDiv.textContent = post.post;

    mainContentDiv.appendChild(userDiv);
    mainContentDiv.appendChild(contentDiv);

    const dateDiv = document.createElement("div");
    dateDiv.className = "date";
    dateDiv.textContent = post.createdAt;

    postDiv.appendChild(mainContentDiv);
    postDiv.appendChild(dateDiv);

    postsContainer.appendChild(postDiv);
    postsContainer.scrollTop = postsContainer.scrollHeight;
}

submitBtn.addEventListener("click", () => {
    const userName = userNameInput.value.trim() || "名無し";
    const postContent = postContentInput.value.trim();

    if (!postContent) {
        alert("投稿内容を入力してください");
        return;
    }

    // WebSocketが接続状態の場合のみ送信
    if (ws.readyState === WebSocket.OPEN) {
        const message = {
            threadId: threadId,
            userName: userName,
            post: postContent,
        };
        ws.send(JSON.stringify(message));
        postContentInput.value = "";
    } else {
        alert("サーバーに接続されていません。");
    }
});
