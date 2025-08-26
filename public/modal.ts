document.addEventListener("DOMContentLoaded", function () {
    const modal = document.getElementById("articleModal");
    const modalTitle = document.getElementById("modalTitle");
    const modalContent = document.getElementById("modalContent");
    const closeBtn = document.getElementsByClassName("close")[0];
    const clickableArticles = document.getElementsByClassName(
        "clickable-article",
    );

    // 記事クリック時の処理
    for (let i = 0; i < clickableArticles.length; i++) {
        clickableArticles[i].addEventListener("click", function () {
            const title = this.getAttribute("data-article-title");
            const content = this.getAttribute("data-article-content");

            modalTitle.textContent = title;
            modalContent.textContent = content;
            modal.style.display = "block";
            document.body.style.overflow = "hidden"; // スクロール無効化
        });
    }

    // 閉じるボタンクリック時の処理
    closeBtn.addEventListener("click", function () {
        modal.style.display = "none";
        document.body.style.overflow = "auto"; // スクロール有効化
    });

    // モーダル外をクリック時の処理
    window.addEventListener("click", function (event) {
        if (event.target === modal) {
            modal.style.display = "none";
            document.body.style.overflow = "auto"; // スクロール有効化
        }
    });

    // ESCキーでモーダルを閉じる
    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape" && modal.style.display === "block") {
            modal.style.display = "none";
            document.body.style.overflow = "auto"; // スクロール有効化
        }
    });
});
