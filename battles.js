const editorArea = document.getElementById("editorArea");
const addBallBtn = document.getElementById("addBallBtn");
let ballCount = 0;

addBallBtn.addEventListener("click", () => {
    ballCount++;
    const ballCard = document.createElement("div");
    ballCard.classList.add("ball-card");

    ballCard.innerHTML = `
        <div style="display:flex;align-items:center;">
            <div class="icon-picker" data-id="${ballCount}"></div>
            <input class="name-input" type="text" placeholder="Ball ${ballCount}" />
        </div>

        <div class="health-options">
            <label>Health Type: 
                <select>
                    <option value="normal">Normal HP</option>
                    <option value="segmented">Segmented</option>
                </select>
            </label>
            <label>Max HP: <input type="number" value="100" min="1" /></label>
            <label>HP Regen/sec: <input type="number" value="0" min="0" /></label>
        </div>

        <div class="weapon-options">
            <label>Weapon: </label>
            <button>Edit Weapon</button>
        </div>
    `;

    editorArea.insertBefore(ballCard, addBallBtn);
});

document.getElementById("startGameBtn").addEventListener("click", () => {
    alert("Start game placeholder – will expand arena and start battle.");
});
