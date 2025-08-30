const fetchAI = async (prompt) => {
    const API_KEY = Deno.env.get("GOOGLE_API_KEY");
    if (!API_KEY) throw new Error("no GOOGLE_API_KEY on Deno.env");
    //const model = "gemini-2.5-flash";
    const model = "gemini-2.5-flash-lite";
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    const body = JSON.stringify({
        contents: [
            {
                parts: [
                    {
                        text: prompt,
                    },
                ],
            },
        ],
    });

    const response = await fetch(`${API_URL}?key=${API_KEY}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: body,
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
            `API request failed: ${response.status} ${response.statusText} - ${
                JSON.stringify(errorData)
            }`,
        );
    }

    const data = await response.json();
    const res = data.candidates[0].content.parts[0].text;
    return res;
};

export const createThreadPostSuggest = async (ctx) => {
    const req = await ctx.req.json();
    const prompt = req.prompt;
    const res = await fetchAI(prompt);
    return ctx.json(res);
};
