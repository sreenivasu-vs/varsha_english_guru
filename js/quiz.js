/* Generic quiz engine: supports mcq, fill, rearrange, error question types. */

function renderQuiz(container, questions, onFinish) {
  let index = 0;
  let score = 0;
  let answered = false;

  function renderQuestion() {
    answered = false;
    const q = questions[index];
    container.innerHTML = "";

    const progress = document.createElement("div");
    progress.className = "quiz-progress";
    progress.textContent = `Question ${index + 1} of ${questions.length}`;
    container.appendChild(progress);

    const qEl = document.createElement("div");
    qEl.className = "quiz-question";
    qEl.textContent = q.question || q.sentence || "";
    container.appendChild(qEl);

    const feedback = document.createElement("div");
    feedback.className = "feedback-box";
    feedback.style.display = "none";

    const nextBtn = document.createElement("button");
    nextBtn.className = "btn block";
    nextBtn.style.marginTop = "12px";
    nextBtn.textContent = index === questions.length - 1 ? "Finish" : "Next Question";
    nextBtn.style.display = "none";
    nextBtn.onclick = () => {
      index += 1;
      if (index >= questions.length) {
        onFinish(score, questions.length);
      } else {
        renderQuestion();
      }
    };

    function checkAnswer(isCorrect, correctText) {
      if (answered) return;
      answered = true;
      if (isCorrect) score += 1;
      feedback.style.display = "block";
      feedback.className = "feedback-box " + (isCorrect ? "correct" : "incorrect");
      feedback.textContent = (isCorrect ? "✔ Correct! " : `✘ Not quite. Correct answer: ${correctText}. `) + (q.explanation || "");
      nextBtn.style.display = "block";
    }

    if (q.type === "mcq") {
      const opts = document.createElement("div");
      opts.className = "quiz-options";
      q.options.forEach((opt) => {
        const btn = document.createElement("button");
        btn.className = "quiz-option";
        btn.textContent = opt;
        btn.onclick = () => {
          if (answered) return;
          const isCorrect = opt === q.answer;
          [...opts.children].forEach((c) => {
            if (c.textContent === q.answer) c.classList.add("correct");
          });
          if (!isCorrect) btn.classList.add("incorrect");
          checkAnswer(isCorrect, q.answer);
        };
        opts.appendChild(btn);
      });
      container.appendChild(opts);
    } else if (q.type === "fill") {
      const input = document.createElement("input");
      input.className = "text-input";
      input.placeholder = "Type your answer...";
      const btn = document.createElement("button");
      btn.className = "btn";
      btn.textContent = "Check";
      btn.onclick = () => {
        if (answered) return;
        const isCorrect = input.value.trim().toLowerCase() === String(q.answer).trim().toLowerCase();
        input.disabled = true;
        checkAnswer(isCorrect, q.answer);
      };
      container.appendChild(input);
      container.appendChild(btn);
    } else if (q.type === "rearrange") {
      const answerZone = document.createElement("div");
      answerZone.className = "rearrange-tokens";
      const bank = document.createElement("div");
      bank.className = "rearrange-bank";

      const shuffled = [...q.words].sort(() => Math.random() - 0.5);
      shuffled.forEach((word) => {
        const tok = document.createElement("button");
        tok.className = "token";
        tok.textContent = word;
        /* One toggle handler based on where the token currently lives - never
           reassign onclick, so a word moved back to the bank stays clickable. */
        tok.onclick = () => {
          if (answered) return;
          if (tok.parentElement === bank) answerZone.appendChild(tok);
          else bank.appendChild(tok);
        };
        bank.appendChild(tok);
      });

      const btn = document.createElement("button");
      btn.className = "btn";
      btn.textContent = "Check";
      btn.onclick = () => {
        if (answered) return;
        const built = [...answerZone.children].map((t) => t.textContent).join(" ");
        const isCorrect = built.toLowerCase() === String(q.answer).toLowerCase();
        checkAnswer(isCorrect, q.answer);
      };

      container.appendChild(document.createTextNode("Tap words in the correct order:"));
      container.appendChild(answerZone);
      container.appendChild(bank);
      container.appendChild(btn);
    } else if (q.type === "error") {
      const input = document.createElement("input");
      input.className = "text-input";
      input.placeholder = "Type the corrected sentence...";
      const btn = document.createElement("button");
      btn.className = "btn";
      btn.textContent = "Check";
      btn.onclick = () => {
        if (answered) return;
        const isCorrect = input.value.trim().toLowerCase() === String(q.correction).trim().toLowerCase();
        input.disabled = true;
        checkAnswer(isCorrect, q.correction);
      };
      container.appendChild(input);
      container.appendChild(btn);
    }

    container.appendChild(feedback);
    container.appendChild(nextBtn);
  }

  renderQuestion();
}
