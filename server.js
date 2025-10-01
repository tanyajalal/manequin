import express from "express"
import fetch from "node-fetch"

const app = express()
app.use(express.json())

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*")
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization")

  if (req.method === "OPTIONS") {
    res.sendStatus(200)
  } else {
    next()
  }
})

app.post("/chat", async (req, res) => {
  const { message, context } = req.body // Also accept context parameter

  try {
    const messages = [
      { role: "system", content: context || "You are a helpful fashion and style assistant." },
      { role: "user", content: message },
    ]

    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: messages,
      }),
    })

    const data = await aiRes.json()
    const reply = data.choices?.[0]?.message?.content || "No response"

    res.json({ response: reply })
  } catch (err) {
    console.error(err)
    res.status(500).json({ response: "Server error" })
  }
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`))
