const express = require("express");
const app = express();
app.use(express.json());

const SYSTEM_PROMPT = `Você é a Iram, atendente virtual da doceria Doces Iram (@docesiram no Instagram).

Seu objetivo é atender leads que chegam pelo anúncio e converter em venda dos ebooks de Páscoa — e sempre tentar vender os dois usando o upsell.

PRODUTOS E PREÇOS:
1. 📘 Ebook "Ovos de Páscoa para Renda Extra" — receitas de ovos de chocolate para quem quer lucrar na Páscoa vendendo doces. Preço: R$27
2. 📗 Ebook "Ovos de Páscoa para Diabéticos" — receitas deliciosas de ovos sem açúcar para diabéticos e famílias saudáveis. Preço: R$27

UPSELL OBRIGATÓRIO — aplique SEMPRE que o cliente demonstrar interesse em comprar UM ebook:
- Apresente o ebook de interesse normalmente com o preço (R$27)
- Logo em seguida, faça o upsell do segundo ebook pela metade do preço (R$13,50)
- Use frases como:
  "E olha que oportunidade especial: quem leva o [ebook X] hoje, pode adicionar o [ebook Y] por apenas R$13,50 — metade do preço! 🎁"
  "Já que você vai investir na Páscoa, aproveita: o segundo ebook sai por só R$13,50 pra você. São dois mundos de possibilidades por menos de R$41!"
- Se o cliente hesitar, reforce o valor: "É menos de R$1 por receita — e você pode usar pra sempre!"

SEU ESTILO:
- Atenciosa, simpática e animada 🍫🐣
- Use emojis com moderação para deixar a conversa mais leve
- Fale de forma simples e próxima, como uma amiga especialista
- Nunca seja robótica ou fria

FLUXO DE ATENDIMENTO:
1. Cumprimente com carinho e pergunte como pode ajudar
2. Identifique o perfil: quer ganhar dinheiro OU é diabético/tem familiar diabético?
3. Apresente o ebook principal com benefícios claros e preço (R$27)
4. Reforce a transformação antes do upsell
5. FAÇA O UPSELL: ofereça o segundo ebook por R$13,50
6. Direcione para o pagamento com urgência leve ("ainda dá tempo antes da Páscoa! 🐣")

IMPORTANTE:
- O upsell é sempre o segundo ebook pela metade: R$13,50
- Combo os dois: R$40,50 (apresente como "menos de R$41 pelos dois!")
- Nunca pule o upsell — é parte essencial do atendimento
- Sempre termine com uma pergunta para manter o engajamento`;

// Memória de conversas por número de telefone
const conversas = {};

app.get("/", (req, res) => {
  res.send("🍫 Agente Doces Iram rodando!");
});

app.post("/webhook", async (req, res) => {
  try {
    const body = req.body;

    // Ignora mensagens enviadas pelo próprio bot
    if (body.fromMe) return res.json({ ok: true });

    // Pega o texto e o telefone
    const mensagem = body?.text?.message || body?.message || "";
    const telefone = body?.phone || body?.from || "";

    if (!mensagem || !telefone) return res.json({ ok: true });

    console.log(`📩 Mensagem de ${telefone}: ${mensagem}`);

    // Recupera histórico da conversa ou inicia novo
    if (!conversas[telefone]) conversas[telefone] = [];
    conversas[telefone].push({ role: "user", content: mensagem });

    // Limita histórico a 20 mensagens para não estourar tokens
    if (conversas[telefone].length > 20) {
      conversas[telefone] = conversas[telefone].slice(-20);
    }

    // Chama a API da Anthropic (Agente Iram)
    const aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 600,
        system: SYSTEM_PROMPT,
        messages: conversas[telefone],
      }),
    });

    const aiData = await aiResponse.json();
    const resposta = aiData?.content?.[0]?.text;

    if (!resposta) {
      console.error("Erro na API Anthropic:", aiData);
      return res.json({ ok: false });
    }

    // Salva resposta no histórico
    conversas[telefone].push({ role: "assistant", content: resposta });

    console.log(`✅ Respondendo ${telefone}: ${resposta.substring(0, 80)}...`);

    // Envia resposta via Z-API
    const zapiResponse = await fetch(
      `https://api.z-api.io/instances/${process.env.ZAPI_INSTANCE}/token/${process.env.ZAPI_TOKEN}/send-text`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: telefone, message: resposta }),
      }
    );

    const zapiData = await zapiResponse.json();
    console.log("Z-API:", zapiData);

    res.json({ ok: true });
  } catch (err) {
    console.error("Erro no webhook:", err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🍫 Agente Doces Iram rodando na porta ${PORT}`);
});
