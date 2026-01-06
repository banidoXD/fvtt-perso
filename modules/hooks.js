const MAX_ATTEMPTS = 1000;
const TARGET_FORMAT = /([^\d]*)[\s]*([\d]+)/;

const whisperError = (error) => {
  console.error(`Fudge | ${error}`);
  ChatMessage.create({
    user: game.user.id,
    whisper: [game.user.id],
    flavor: "Fudge",
    content: `<div>Error: ${error}</div>`
  });
};

const parseTarget = (target) => {
  if (!target) return undefined;
  const match = target.match(TARGET_FORMAT);
  if (!match) return undefined;

  const condition = match[1].trim();
  const value = parseInt(match[2].trim());
  switch (condition) {
    case "lt":
    case "<":
      return { condition: "lt", value };
    case "lte":
    case "<=":
      return { condition: "lte", value };
    case "gt":
    case ">":
      return { condition: "gt", value };
    case "gte":
    case ">=":
      return { condition: "gte", value };
    case "":
    case "eq":
    case "=":
    case "==":
    case "===":
      return { condition: "eq", value };
    default:
      return undefined;
  };
};

const parseDialogDoc = (html) => {
  try {
    // Na Dialog do Foundry, 'html' geralmente é um objeto jQuery
    const formula = html.find("input[name=formula]").val();
    const targetVal = html.find("input[name=target]").val();
    const target = parseTarget(targetVal);
    return { formula, target };
  } catch (e) {
    console.error(e);
    return { formula: undefined, target: undefined };
  }
}

const evaluateTotalVsTarget = (total, target) => {
  switch (target.condition) {
    case "eq": return total === target.value;
    case "gt": return total > target.value;
    case "gte": return total >= target.value;
    case "lt": return total < target.value;
    case "lte": return total <= target.value;
  }
};

const onSubmit = async (html) => {
  const { formula, target } = parseDialogDoc(html);
  
  if (!formula) return whisperError("Missing Formula");
  if (!target || !target.condition) return whisperError("Invalid Target Format");

  // Teste inicial para ver se a fórmula é válida
  try {
    const testRoll = new Roll(formula);
    // Na V13, evaluate é async
    await testRoll.evaluate(); 
  } catch (e) {
    console.error(e);
    return whisperError("Invalid Formula");
  }

  // Loop de tentativa
  // ATENÇÃO: Como agora é async, isso pode demorar um pouco se o número for difícil
  ui.notifications.info("Fudging dice... please wait.");
  
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const dice = new Roll(formula);
    
    // A MUDANÇA CRUCIAL: await no evaluate()
    await dice.evaluate();
    
    const total = dice.total;
    
    if (evaluateTotalVsTarget(total, target)) {
      // Sucesso! Envia pro chat
      await dice.toMessage({
        speaker: ChatMessage.getSpeaker()
      }, {
        rollMode: "roll"
      });
      console.log(`Foundry VTT | Fudge | Fudged in ${i+1} attempts.`);
      return;
    }
  }
  
  whisperError("Max Attempts Reached (1000 tries failed)");
};

const showDialog = async () => {
  // Verifique se o caminho do template está correto no seu projeto
  // Se module.json id for "fudge", a pasta deve ser modules/fudge/templates/...
  const contentHtml = await renderTemplate("modules/perso/templates/dialog.html", {});
  
  return new Promise((resolve) => {
    new Dialog({
      title: 'Fudge',
      content: contentHtml,
      buttons: {
        roll: {
          label: "Roll",
          callback: async (html) => {
            resolve(await onSubmit(html));
          }
        }
      },
      default: "roll",
      close: () => resolve(null),
      render: (html) => {
        // html é jQuery aqui
        html.find("input[name=formula]").focus();
      }
    }).render(true);
  });
}

Hooks.on("getSceneControlButtons", (controls) => {
  if (!game.user.isGM) return;

  const bar = controls.find((c) => c.name === "token");
  if (bar) {
      bar.tools.push({
        name: "fudge",
        title: "Fudge",
        icon: "fas fa-dice-d20", // Mudei o ícone de cocô (poo) para d20, mas pode voltar se quiser rs
        onClick: () => showDialog(),
        button: true
      });
  }
});
