// --- 1. URLからパラメータを取得 ---
const queryString = globalThis.location.search;
const params = new URLSearchParams(queryString);
const newspaperId = params.get("newspaper-id");
const index = params.get("index");
// const title = params.get("title");
const threadId = params.get("thread-id");
// let threadId;

// --- 2. HTML要素を取得 ---
const titleElement = document.getElementById("title");
const postsContainer = document.getElementById("posts");
const userNameInput = document.getElementById("userName");
const postContentInput = document.getElementById("postContent");
const submitBtn = document.getElementById("submitBtn");

// --- 3. スレッドを閉じる関数 ---
const closeThread = () => {
    userNameInput.disabled = true;
    postContentInput.disabled = true;
    submitBtn.disabled = true;
    postContentInput.placeholder = "このスレッドはCloseされています。";
    const closeDiv = document.createElement("div");
    closeDiv.textContent = "(Close済み)";
    titleElement.appendChild(closeDiv);
};

// --- 4. WebSocket接続を確立 ---
const wsProtocol = location.protocol === "https:" ? "wss" : "ws";
const ws = new WebSocket(
    `${wsProtocol}://${location.host}/ws?newspaper-id=${newspaperId}&index=${index}&thread-id=${threadId}`,
);

// --- 5. WebSocketのイベントハンドラを設定 ---

ws.onopen = () => {
    console.log("WebSocket接続成功");
};

// メッセージ受信時の処理
ws.onmessage = (event) => {
    const data = JSON.parse(event.data);

    // サーバーからの初期データを受信した場合
    if (data.type === "start") {
        const title = data.thread.title;
        const span = document.createElement("span"); // タイトルのspanを作成
        span.innerHTML = title ? title : "掲示板";
        titleElement.appendChild(span); // 親要素に追加
        // threadId = data.thread.uuid;
        renderInitialPosts(data.posts);
        if (!data.thread.enable) {
            closeThread();
        }
    } // 新しい投稿がブロードキャストされてきた場合 (サーバー側の実装に依存)
    else if (data.type === "new_post") {
        if (data.index === 0) {
            renderInitialPosts([data.post]);
        } else {
            appendPost(data.post, data.index);
        }
    } else if (data.type === "max_new_post") {
        appendPost(data.post, data.index);
        closeThread();
        alert("スレッド内投稿数が上限に達しました。");
    } else if (data.type === "full") {
        alert(data.message);
        closeThread();
    } // エラーメッセージを受信した場合
    else if (data.type === "error") {
        alert(data.message);
    }
};

// 接続が切れたときの処理
ws.onclose = () => {
    console.log("WebSocket接続が切れました。");
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
    posts.forEach((post, index) => {
        appendPost(post, index);
    });
}

// ひとつの投稿をリストの末尾に追加する関数
function appendPost(post, index) {
    // 投稿全体のdivを作成
    const div = document.createElement("div");
    div.className = "post";

    // 投稿者情報と本文をまとめるラッパーdiv
    const innerWrapper = document.createElement("div");

    // 1行目：投稿者情報のdivを作成
    const headerDiv = document.createElement("div");

    // ユーザー名のspanを作成
    const userSpan = document.createElement("span");
    userSpan.className = "user";
    userSpan.textContent = post.userName; // ★ 安全にユーザー名を設定

    // 日付のspanを作成
    const dateSpan = document.createElement("span");
    dateSpan.className = "date";
    dateSpan.textContent = `:${post.createdAt}`; // ★ 安全に日付を設定

    // headerDivに「番号:」「ユーザー名」「日付」の順で追加
    headerDiv.append(`${index + 1}:`); // appendはテキストと要素を混在して追加できる
    headerDiv.appendChild(userSpan);
    headerDiv.appendChild(dateSpan);

    // 2行目：投稿内容のdivを作成
    const contentDiv = document.createElement("div");
    contentDiv.className = "content";
    contentDiv.textContent = post.post; // ★ 安全に投稿内容を設定

    // innerWrapperにheaderDivとcontentDivを追加
    innerWrapper.appendChild(headerDiv);
    innerWrapper.appendChild(contentDiv);

    // 最後に、完成したinnerWrapperをpostクラスを持つdivに追加
    div.appendChild(innerWrapper);
    postsContainer.appendChild(div);
}

const sendFnc = () => {
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
        postContentInput.focus();
        submitBtn.scrollIntoView({
            behavior: "smooth",
            block: "start",
        });
    } else {
        alert("サーバーに接続されていません。");
    }
};

submitBtn.addEventListener("click", sendFnc);

// IME入力中かどうかを判定するフラグ
let isComposing = false;

// IME入力開始時
postContentInput.addEventListener("compositionstart", () => {
    isComposing = true;
});

// IME入力終了時
postContentInput.addEventListener("compositionend", () => {
    isComposing = false;
});

postContentInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !isComposing) {
        e.preventDefault();
        sendFnc();
    }
});

const getPrompt = (type, title, body) => {
    const ss = [];
    if (type == "suggest") {
        ss.push(`今から提示する掲示板にスレッド内の意見と被らない1人分の投稿を匿名掲示板らしく砕けた表現で、2行以内の名前を含まない本文のみで記述してください。`);
    } else if (type == "agree" || type == "disagree") {
        const aord = type == "agree" ? "同意的な" : "批判的だけど発展的な";
        ss.push(`今から提示する掲示板のスレッド内の流れに対して${aord}1人分の投稿を、匿名掲示板らしく砕けた表現で、2行以内の本文のみで記述してください。`);
    }
    ss.push(`スレッド内の名前"名無し"は名前が存在しない人の名前です。

## スレッドのタイトル: ${title}
${body}`);
    return ss.join("\n");
};

const aiSuggest = async (type) => {
    const title = titleElement.textContent;
    const contents = postsContainer.querySelectorAll(".user,.content");
    const list = [];
    for (let i = 0; i < contents.length; i += 2) {
        list.push(contents[i].textContent + ": " + contents[i + 1].textContent);
    }
    const body = list.join("\n");
    
    const prompt = getPrompt(type, title, body);
    if (!prompt) throw new Error("no prompt");
    const response = await fetch("/create-post-suggest", {
        method: "POST",
        "Content-Type": "application/json",
        body: JSON.stringify({ prompt }),
    });
    const res = await response.json();
    console.log(res);
    postContentInput.value = res;
};

suggestBtn.onclick = async () => await aiSuggest("suggest");
agreeBtn.onclick = async () => await aiSuggest("agree");
disagreeBtn.onclick = async () => await aiSuggest("disagree");
