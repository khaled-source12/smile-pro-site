let currentStep = 1;
    let pixelsPerMM = 1; // Factor calculated from calibration
    let currentScore = 0;
    let testRound = 0;
    const totalRounds = 4;

    // Angles for E symbol: 0=Right, 90=Down, 180=Left, 270=Up
    const orientations = [
        { angle: 0, dir: 'right' },
        { angle: 90, dir: 'down' },
        { angle: 180, dir: 'left' },
        { angle: 270, dir: 'up' }
    ];
    let currentOrientation = {};

    function nextStep(step) {
        document.querySelectorAll('.step').forEach(el => el.classList.remove('active'));
        document.getElementById(`step-${step}`).classList.add('active');
        currentStep = step;

        if (step === 3) {
            startAcuityTest();
        }
    }

    // Step 2: Calibration logic
    function adjustCardSize(val) {
        const card = document.getElementById('credit-card');
        card.style.width = val + 'px';
        card.style.height = (val * 0.63) + 'px'; // Standard credit card ratio
    }

    function finishCalibration() {
        const cardWidthPx = parseFloat(document.getElementById('credit-card').style.width) || 300;
        // Standard credit card width is 85.6 mm
        pixelsPerMM = cardWidthPx / 85.6;
        nextStep(3);
    }

    // Step 3: Visual Acuity Logic
    function startAcuityTest() {
        if (testRound < totalRounds) {
            testRound++;
            // Calculate size based on round (smaller each round)
            // 5 arcminutes size formula simplified for distance
            const baseSizeMM = 15 - (testRound * 2.5); // Shrinking size in MM
            const sizeInPixels = baseSizeMM * pixelsPerMM;

            const eSymbol = document.getElementById('e-symbol');
            eSymbol.style.fontSize = sizeInPixels + 'px';

            // Random orientation
            currentOrientation = orientations[Math.floor(Math.random() * orientations.length)];
            eSymbol.style.transform = `rotate(${currentOrientation.angle}deg)`;
        } else {
            nextStep(4);
        }
    }

    function checkAnswer(userDir) {
        if (userDir === currentOrientation.dir) {
            currentScore++;
        }
        startAcuityTest();
    }

    // Step 4: UI-only input demo. It deliberately produces no medical result.
    function checkColorTest() {
        showResults();
    }

    // Step 5: Confirm completion without interpreting the user's answers.
    function showResults() {
        nextStep(5);
        const resultText = document.getElementById('result-text');
        resultText.textContent = document.documentElement.lang.startsWith('ar')
            ? "اكتملت تجربة الواجهة. لم يتم احتساب حدة إبصار أو تمييز ألوان، ولا توجد نتيجة طبية من هذه الصفحة."
            : "The interface demo is complete. No visual-acuity or colour-vision score was calculated, and this page provides no medical result.";
    }

    window.nextStep = nextStep;
    window.adjustCardSize = adjustCardSize;
    window.finishCalibration = finishCalibration;
    window.checkAnswer = checkAnswer;
    window.checkColorTest = checkColorTest;
