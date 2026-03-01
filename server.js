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
function checkTelegramSignature(initData) {
  const secret = crypto.createHmac("sha256", BOT_TOKEN).update("WebAppData").digest();

  const params = initData
    .split("&")
    .map((s) => s.split("="))
    .reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {});

  const hash = params.hash;
  delete params.hash;

  const dataCheckString = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("\n");

  const hmac = crypto.createHmac("sha256", secret).update(dataCheckString).digest("hex");

  return hmac === hash;
}

// ===== Тестовый маршрут =====
app.get("/", (req, res) => {
  res.send("<h1>API is working 🚀</h1>");
});

// ===== Создание заказа =====
app.post("/order", async (req, res) => {
  const { cart, user, initData } = req.body;

  if (!cart || !user || !initData) {
    return res.status(400).json({ error: "Missing data" });
  }

  if (!checkTelegramSignature(initData)) {
    return res.status(403).json({ error: "Invalid Telegram signature" });
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
      body: JSON.stringify({ chat_id: user.id, text: message }),
    });

    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to send message" });
  }
});

// ===== Запуск сервера =====
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));