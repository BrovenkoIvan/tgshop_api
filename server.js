require("dotenv").config();
const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const crypto = require("crypto");

const app = express();
app.use(cors());
app.use(express.json());

const BOT_TOKEN = process.env.BOT_TOKEN;
const PORT = process.env.PORT || 5000;

// ===== Проверка подписи Telegram =====
function validateTelegramWebAppData(initData) {
  const secretKey = crypto
    .createHash("sha256")
    .update(BOT_TOKEN)
    .digest();

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  params.delete("hash");

  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const hmac = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  return hmac === hash;
}

// ===== Достаём пользователя из initData =====
function getUserFromInitData(initData) {
  const params = new URLSearchParams(initData);
  const user = params.get("user");
  return user ? JSON.parse(user) : null;
}

// ===== Тест =====
app.get("/", (req, res) => {
  res.send("API is working 🚀");
});

// ===== Создание заказа =====
app.post("/order", async (req, res) => {
  const { cart, initData } = req.body;

  if (!cart || !initData) {
    return res.status(400).json({ error: "Missing data" });
  }

  // Проверяем подпись
  if (!validateTelegramWebAppData(initData)) {
    return res.status(403).json({ error: "Invalid Telegram signature" });
  }

  // Получаем user ТОЛЬКО с сервера
  const user = getUserFromInitData(initData);

  if (!user) {
    return res.status(400).json({ error: "User not found in initData" });
  }

  const total = cart.reduce((sum, item) => sum + item.price, 0);

  const message = `
🛒 Новый заказ
👤 ${user.first_name}
🆔 ${user.id}

Товары:
${cart.map((item) => `- ${item.name} (${item.price} грн)`).join("\n")}

💰 Итого: ${total} грн
`;

  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: user.id,
        text: message,
      }),
    });

    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to send message" });
  }
});

app.listen(PORT, () =>
  console.log(`Server running on port ${PORT}`)
);