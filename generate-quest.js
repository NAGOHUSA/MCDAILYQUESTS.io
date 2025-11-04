const fs = require('fs');
const path = require('path');
const { groq } = require('@ai-sdk/groq');
const { generateObject } = require('ai');
const { z } = require('zod');

async function generateQuest() {
  const today = new Date().toISOString().split('T')[0];
  const outputPath = path.join('quests', `${today}.json`);

  if (!fs.existsSync('quests')) {
    fs.mkdirSync('quests', { recursive: true });
  }

  const { object } = await generateObject({
    model: groq('llama-3.1-8b-instant'),
    schema: z.object({
      title: z.string().describe('Fun, mysterious quest title (10-15 words max)'),
      lore: z.string().max(200).describe('2-3 sentences immersive backstory'),
      steps: z.array(z.string().max(150)).min(1).max(3).describe('1-3 clear, vanilla Minecraft steps (no mods)'),
      reward: z.string().max(100).describe('Creative, craftable reward idea'),
      biomeHint: z.string().max(50).describe('Suggested biome/dimension to start'),
    }),
    prompt: `Generate ONE epic vanilla Minecraft quest for ${today}. Fun, shareable, seed-compatible (any world). Exploration/puzzle focus. No mods, no complex redstone.

Output ONLY the structured fields. Theme: Mysterious [random: artifact, echo, curse, forge, whisper]. 

Example:
Title: The Silent Spore
Lore: Deep in mushroom fields...
Steps: ["Step 1", "Step 2"]
etc.

Keep steps realistic for survival mode.`,
  });

  const quest = {
    date: today,
    ...object,
    id: today.replace(/-/g, ''),
  };

  fs.writeFileSync(outputPath, JSON.stringify(quest, null, 2));
  console.log(`✅ Generated: ${quest.title} for ${today}`);
}

generateQuest().catch(console.error);
