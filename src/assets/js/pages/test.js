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

    // Step 4: Color Vision Logic
    function checkColorTest() {
        const ans = document.getElementById('color-answer').value;
        let colorResult = (ans === '74') ? "تمتلك تمييزاً جيداً للألوان." : "قد يكون لديك صعوبة بسيطة في تمييز بعض الألوان.";
        showResults(colorResult);
    }

    // Step 5: Show Final Results
    function showResults(colorResult) {
        nextStep(5);
        const resultText = document.getElementById('result-text');
        let visionStatus = "";

        if (currentScore >= 3) {
            visionStatus = "حدة الإبصار المبدئية: **جيدة جداً**.";
        } else {
            visionStatus = "حدة الإبصار المبدئية: **منخفضة**، يُنصح بإجراء كشف نظر عند الطبيب.";
        }

        resultText.innerHTML = `${visionStatus}<br><br>${colorResult}`;
    }
