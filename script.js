document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    // Signal Type Select removed from active use
    const amplitudeSlider = document.getElementById('amplitude');
    const amplitudeValueSpan = document.getElementById('amplitude-value');
    const frequencySlider = document.getElementById('frequency');
    const frequencyValueSpan = document.getElementById('frequency-value');
    const phaseSlider = document.getElementById('phase');
    const phaseValueSpan = document.getElementById('phase-value');
    const durationSlider = document.getElementById('duration');
    const durationValueSpan = document.getElementById('duration-value');

    const samplingRateSlider = document.getElementById('sampling-rate');
    const samplingRateValueSpan = document.getElementById('sampling-rate-value');
    const nyquistInfoSpan = document.getElementById('nyquist-info');
    const aliasingWarningSpan = document.getElementById('aliasing-warning');

    const quantizationLevelsSelect = document.getElementById('quantization-levels');
    const bitsInfoSpan = document.getElementById('bits-info');
    const quantizationErrorInfoSpan = document.getElementById('quantization-error-info');

    const binaryDataHeaderPre = document.getElementById('binary-data-header'); // For header
    const binaryDataPre = document.getElementById('binary-data');          // For data rows
    const snrInfoSpan = document.getElementById('snr-info');

    const runButton = document.getElementById('run-simulation');
    const resetButton = document.getElementById('reset-simulation');
    const themeToggleButton = document.getElementById('theme-toggle');

    // --- Chart Contexts & Instances ---
    const ctxOriginal = document.getElementById('original-signal-chart').getContext('2d');
    const ctxSampled = document.getElementById('sampled-signal-chart').getContext('2d');
    const ctxQuantized = document.getElementById('quantized-signal-chart').getContext('2d');
    const ctxReconstructed = document.getElementById('reconstructed-signal-chart').getContext('2d');

    let originalChart, sampledChart, quantizedChart, reconstructedChart;

    // --- Default Values ---
    const defaultSettings = {
        // signalType: 'sine', // No longer needed as choice removed
        amplitude: 1,
        frequency: 2,
        phase: 0,
        duration: 1,
        samplingRate: 20,
        quantizationLevels: 16,
    };

    // --- State ---
    let currentSettings = { ...defaultSettings };
    let simulationData = {}; // To store results like sampled points, quantized values etc.

    // --- Chart Configuration ---
    const chartOptions = (title, isDarkMode = false) => ({
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            title: { display: true, text: title, color: isDarkMode ? '#f1f1f1' : '#333' },
            legend: { labels: { color: isDarkMode ? '#f1f1f1' : '#333' } }
        },
        scales: {
            x: {
                type: 'linear',
                position: 'bottom',
                title: { display: true, text: 'Time (s)', color: isDarkMode ? '#f1f1f1' : '#333' },
                grid: { color: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' },
                ticks: { color: isDarkMode ? '#f1f1f1' : '#333' }
            },
            y: {
                title: { display: true, text: 'Amplitude', color: isDarkMode ? '#f1f1f1' : '#333' },
                grid: { color: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' },
                ticks: { color: isDarkMode ? '#f1f1f1' : '#333' }
            }
        }
    });

    // --- Initialization ---
    function initializeCharts() {
        const isDark = document.body.classList.contains('dark-mode');
        if (originalChart) originalChart.destroy();
        originalChart = new Chart(ctxOriginal, {
            type: 'line',
            data: { datasets: [] },
            options: chartOptions('Original Analog Signal', isDark)
        });

        if (sampledChart) sampledChart.destroy();
        sampledChart = new Chart(ctxSampled, {
            type: 'line', // Show line + points
            data: { datasets: [] },
            options: chartOptions('Sampled Signal', isDark)
        });

        if (quantizedChart) quantizedChart.destroy();
        quantizedChart = new Chart(ctxQuantized, {
            type: 'line', // Show stepped line
            data: { datasets: [] },
            options: chartOptions('Quantized Signal', isDark)
        });

        if (reconstructedChart) reconstructedChart.destroy();
        reconstructedChart = new Chart(ctxReconstructed, {
            type: 'line',
            data: { datasets: [] },
            options: chartOptions('Reconstructed Signal vs Original', isDark)
        });
    }

    function setupEventListeners() {
        // Input Signal Controls
        // signalTypeSelect removed
        amplitudeSlider.addEventListener('input', updateSettings);
        frequencySlider.addEventListener('input', updateSettings);
        phaseSlider.addEventListener('input', updateSettings);
        durationSlider.addEventListener('input', updateSettings);

        // PCM Parameter Controls
        samplingRateSlider.addEventListener('input', updateSettings);
        quantizationLevelsSelect.addEventListener('change', updateSettings);

        // Action Buttons
        runButton.addEventListener('click', runFullSimulation);
        resetButton.addEventListener('click', resetSimulation);
        themeToggleButton.addEventListener('click', toggleTheme);

        // Update display on initial load
        updateDisplays();
        initializeCharts();
        // Run initial simulation on load
        runFullSimulation();
    }

    // --- Update Functions ---
    function updateSettings(event) {
        const id = event.target.id;
        let value = event.target.value;

        // Determine the correct key in currentSettings (kebab-case to camelCase/snake_case)
        let settingKey = id.replace(/-([a-z])/g, (g) => g[1].toUpperCase()); // Converts sampling-rate to samplingRate etc.
        // Ensure keys match the defaultSettings object
        if (!(settingKey in currentSettings)) {
             settingKey = id.replace(/-/g, '_'); // Fallback if using snake_case
        }
         if (!(settingKey in currentSettings)) { // If still not found, maybe log an error or skip
             console.error("Could not map element ID to setting:", id);
             return;
         }


        if (event.target.type === 'range') {
            value = parseFloat(value);
        } else if (id === 'quantization-levels') {
            value = parseInt(value);
        }
        // Explicitly handle signal-type if needed, though it's fixed now
        else if (id === 'signal-type') {
             value = 'sine'; // Hardcoded
        }


        currentSettings[settingKey] = value;

        // Update display values
        updateDisplays(); // Update text spans like Hz, degrees etc.

        // Special handling for dependent info
        if (id === 'frequency' || id === 'sampling-rate') {
            updateNyquistInfo();
        }
        if (id === 'quantization-levels') {
            updateBitsInfo();
        }


        // --- Auto-run Logic ---
        // Update original signal preview instantly for signal parameter changes
        if (id === 'amplitude' || id === 'frequency' || id === 'phase' || id === 'duration') {
            generateAndDisplayOriginalSignal();
            // Optionally run full simulation if you want *everything* to update on signal change
            // runFullSimulation();
        }
        // Run the *full* PCM simulation automatically for PCM parameter changes
        else if (id === 'sampling-rate' || id === 'quantization-levels') {
            runFullSimulation();
        }
    }

     function updateDisplays() {
        amplitudeValueSpan.textContent = parseFloat(amplitudeSlider.value).toFixed(1);
        frequencyValueSpan.textContent = `${frequencySlider.value} Hz`;
        phaseValueSpan.textContent = `${phaseSlider.value}°`;
        durationValueSpan.textContent = `${parseFloat(durationSlider.value).toFixed(1)} s`;
        samplingRateValueSpan.textContent = `${samplingRateSlider.value} Hz`;
        updateNyquistInfo(); // Ensure Nyquist updates when frequency OR sampling rate changes
        updateBitsInfo();
    }

    function updateNyquistInfo() {
        const f = currentSettings.frequency;
        const Fs = currentSettings.samplingRate;
        const nyquistRate = 2 * f;
        nyquistInfoSpan.textContent = `Nyquist Rate: ${nyquistRate} Hz`;
        aliasingWarningSpan.style.display = Fs < nyquistRate ? 'inline' : 'none';
    }

     function updateBitsInfo() {
        const levels = currentSettings.quantizationLevels;
        const bits = Math.log2(levels);
        bitsInfoSpan.textContent = `Bits per sample: ${bits}`;
    }

    // --- Signal Generation ---
    function generateAnalogSignal() {
        // Removed signalType dependency, always sine
        const { amplitude: A, frequency: f, phase: phiDeg, duration: T } = currentSettings;
        const phiRad = phiDeg * (Math.PI / 180);
        const numPoints = 500; // Number of points for smooth plotting
        const dt = T / (numPoints - 1);
        const data = [];
        const omega = 2 * Math.PI * f;

        for (let i = 0; i < numPoints; i++) {
            const t = i * dt;
            const y = A * Math.sin(omega * t + phiRad); // Only Sine wave
            data.push({ x: t, y: y });
        }
        simulationData.analogSignal = data;
        return data;
    }

    // --- PCM Stages ---
    function sampleSignal(analogSignal) {
        const { samplingRate: Fs, duration: T } = currentSettings;
        if (Fs <= 0) { // Avoid division by zero or infinite loop
            simulationData.sampledSignal = [];
            return [];
        }
        const Ts = 1 / Fs; // Sampling period
        const sampledPoints = [];
        let lastAddedX = -Infinity; // Prevent adding points too close together

        // Interpolate signal value at exact sample times
        for (let t = 0; t <= T + 1e-9; t += Ts) { // Add epsilon for floating point precision at T
            const exactTime = Math.min(t, T); // Clamp time to duration

             // Find points surrounding the exact time t
             let p1 = null, p2 = null;
             for(let j=0; j < analogSignal.length - 1; j++) {
                 if (analogSignal[j].x <= exactTime && analogSignal[j+1].x >= exactTime) {
                     p1 = analogSignal[j];
                     p2 = analogSignal[j+1];
                     break;
                 }
             }

             let yValue;
             if (p1 && p2) {
                 // Linear interpolation between the two closest analog points
                 if (Math.abs(p1.x - p2.x) < 1e-9) { // Avoid division by zero if points are identical
                     yValue = p1.y;
                 } else {
                     const slope = (p2.y - p1.y) / (p2.x - p1.x);
                     yValue = p1.y + slope * (exactTime - p1.x);
                 }
             } else if (analogSignal.length > 0) {
                 // Edge case: if t is before first point or after last point (shouldn't happen often with +1e-9)
                 yValue = analogSignal[analogSignal.length - 1].y; // Use last known value
             } else {
                 yValue = 0; // No signal data
             }


             // Ensure we don't add duplicate x values if Ts is very small relative to analog dt
            if (Math.abs(exactTime - lastAddedX) > 1e-9) {
                sampledPoints.push({ x: exactTime, y: yValue });
                lastAddedX = exactTime;
            }
        }

        simulationData.sampledSignal = sampledPoints;
        return sampledPoints;
    }


    function quantizeSignal(sampledSignal) {
        const { quantizationLevels: L, amplitude: A } = currentSettings;
        if (L <= 0) return []; // Avoid issues with invalid levels

        const Vmax = A;
        const Vmin = -A;
        // Ensure range is non-zero, even if A is small
        const range = Math.max(Vmax - Vmin, 1e-9);
        const delta = range / L; // Step size
        const quantizedPoints = [];
        let quantizationErrorSumSq = 0;

        sampledSignal.forEach(point => {
            // Clamp the signal within Vmin and Vmax *before* quantizing
             // Add small epsilon to Vmax for clamping to handle potential floating point issues at the boundary
            const clampedY = Math.max(Vmin, Math.min(Vmax, point.y));

            // Find the quantization level index
            // Ensure the index calculation doesn't go below 0 due to floating point issues near Vmin
            let levelIndex = Math.floor(Math.max(0, (clampedY - Vmin)) / delta);

            // Clamp index to be within [0, L-1]
            levelIndex = Math.max(0, Math.min(L - 1, levelIndex));


            // Calculate the quantized value (mid-point of the interval)
            const quantizedY = Vmin + (levelIndex + 0.5) * delta;
            quantizedPoints.push({ x: point.x, y: quantizedY, level: levelIndex });

            // Calculate error for this point (using original sample value)
            const error = point.y - quantizedY;
            quantizationErrorSumSq += error * error;
        });

        const meanSquaredError = sampledSignal.length > 0 ? quantizationErrorSumSq / sampledSignal.length : 0;

        simulationData.quantizedSignal = quantizedPoints;
        simulationData.quantizationMSE = meanSquaredError;
        quantizationErrorInfoSpan.textContent = `Quantization Error (Approx. MSE): ${meanSquaredError.toExponential(3)}`;

        return quantizedPoints;
    }

    function encodeSignal(quantizedSignal) {
        const { quantizationLevels: L } = currentSettings;
        const bits = L > 1 ? Math.log2(L) : 0; // Handle L=1 case
        const encodedData = [];

        quantizedSignal.forEach((point, index) => {
            const decimalValue = point.level;
            // Ensure bits is an integer for padStart
            const numBits = Math.max(1, Math.ceil(bits)); // At least 1 bit
            const binaryString = decimalValue.toString(2).padStart(numBits, '0');
            encodedData.push({
                sampleNum: index,
                quantizedLevel: decimalValue,
                binaryCode: binaryString
            });
        });

        simulationData.encodedData = encodedData;
        return encodedData;
    }

    function reconstructSignal(quantizedSignal) {
        // Zero-Order Hold Reconstruction
        const reconstructedPoints = [];
        if (!quantizedSignal || quantizedSignal.length === 0) {
             simulationData.reconstructedSignal = [];
             return [];
        }

        for (let i = 0; i < quantizedSignal.length; i++) {
            const currentPoint = quantizedSignal[i];
            // Start of the hold interval
            reconstructedPoints.push({ x: currentPoint.x, y: currentPoint.y });

            // End of the hold interval
            if (i < quantizedSignal.length - 1) {
                const nextPointX = quantizedSignal[i + 1].x;
                // Add a point just before the next sample to create the step
                 reconstructedPoints.push({ x: nextPointX - 1e-9, y: currentPoint.y }); // Tiny offset before change
            } else {
                 // Hold the last value until the end of the duration
                 reconstructedPoints.push({ x: currentSettings.duration, y: currentPoint.y });
            }
        }
        simulationData.reconstructedSignal = reconstructedPoints;
        return reconstructedPoints;
    }

    // --- Analysis ---
    function calculateSNR() {
         // Simplified SNR based on quantization bits (common approximation)
         const L = currentSettings.quantizationLevels;
         if (L <= 1) { // SNR is not well-defined for 1 level (0 bits)
             snrInfoSpan.textContent = `Estimated SNR (Quantization): N/A`;
             simulationData.snr = NaN;
             return NaN;
         }
         const bits = Math.log2(L);
         // Formula: SNR ≈ 6.02 * n + 1.76 dB (for full-range sine wave)
         const snr = 6.02 * bits + 1.76;
         simulationData.snr = snr;
         snrInfoSpan.textContent = `Estimated SNR (Quantization): ${snr.toFixed(2)} dB`;
         return snr;
    }


    // --- Chart Update Functions ---
    // (updateOriginalChart, updateSampledChart, updateQuantizedChart, updateReconstructedChart remain largely the same as before)
    // Minor adjustments might be needed in axis limits if amplitude changes drastically,
    // but the basic structure is sound. Adding them here for completeness.

    function updateOriginalChart(data) {
        const isDark = document.body.classList.contains('dark-mode');
        originalChart.data.labels = data.map(p => p.x);
        originalChart.data.datasets = [{
            label: 'Analog Signal',
            data: data,
            borderColor: isDark ? '#4da3ff' : '#007bff',
            borderWidth: 2,
            pointRadius: 0, // Hide points for a smooth line
            tension: 0.1 // Slight smoothing
        }];
        originalChart.options = chartOptions('Original Analog Signal', isDark); // Update options for theme change
        originalChart.options.scales.y.min = -currentSettings.amplitude * 1.1; // Adjust Y scale based on current amplitude
        originalChart.options.scales.y.max = currentSettings.amplitude * 1.1;
        originalChart.update();
    }

     function updateSampledChart(originalData, sampledData) {
        const isDark = document.body.classList.contains('dark-mode');
        sampledChart.data.labels = originalData.map(p => p.x); // Use original x-axis for context
        sampledChart.data.datasets = [
            {
                label: 'Original (for reference)',
                data: originalData,
                borderColor: isDark ? 'rgba(200, 200, 200, 0.5)' : 'rgba(150, 150, 150, 0.5)',
                borderWidth: 1,
                pointRadius: 0,
                borderDash: [5, 5], // Dashed line for reference
                type: 'line',
                tension: 0.1
            },
            {
                label: 'Sampled Points',
                data: sampledData,
                borderColor: isDark ? '#ff6b7a' : '#dc3545', // Red color for samples
                backgroundColor: isDark ? '#ff6b7a' : '#dc3545',
                pointRadius: 5,
                pointHoverRadius: 7,
                showLine: false, // Don't connect the sample points with lines
                type: 'scatter'
            }
        ];
         sampledChart.options = chartOptions('Sampled Signal', isDark);
         sampledChart.options.scales.y.min = -currentSettings.amplitude * 1.1; // Adjust Y scale
         sampledChart.options.scales.y.max = currentSettings.amplitude * 1.1;
        sampledChart.update();
    }

    function updateQuantizedChart(sampledData, quantizedData) {
        const isDark = document.body.classList.contains('dark-mode');
        // Create stepped data for visualization
        const steppedQuantizedData = [];
        if (quantizedData.length > 0) {
             for (let i = 0; i < quantizedData.length; i++) {
                 // Start of step
                 steppedQuantizedData.push({ x: quantizedData[i].x, y: quantizedData[i].y });
                 // End of step (at time of next sample, or duration end)
                 if (i < quantizedData.length - 1) {
                     steppedQuantizedData.push({ x: quantizedData[i+1].x - 1e-9, y: quantizedData[i].y });
                 } else {
                      if(quantizedData[i].x < currentSettings.duration) {
                         steppedQuantizedData.push({ x: currentSettings.duration, y: quantizedData[i].y });
                     }
                 }
             }
         }


        quantizedChart.data.labels = sampledData.map(p => p.x); // Use sampled x-axis
        quantizedChart.data.datasets = [
             {
                 label: 'Original Samples (dots)', // Show original sample locations
                 data: sampledData,
                 borderColor: isDark ? 'rgba(200, 200, 200, 0.5)' : 'rgba(150, 150, 150, 0.5)',
                 backgroundColor: isDark ? 'rgba(200, 200, 200, 0.5)' : 'rgba(150, 150, 150, 0.5)',
                 pointRadius: 3,
                 showLine: false,
                 type: 'scatter',
                 order: 1 // Draw samples on top
             },
            {
                label: 'Quantized Level',
                data: steppedQuantizedData, // Use the manually stepped data
                borderColor: isDark ? '#28a745' : '#198754', // Green for quantized
                borderWidth: 2,
                pointRadius: 0,
                stepped: false, // We manually created the steps
                tension: 0, // Sharp corners
                type: 'line',
                order: 0 // Draw line underneath
            }
        ];
         quantizedChart.options = chartOptions('Quantized Signal', isDark);
         quantizedChart.options.scales.y.min = -currentSettings.amplitude * 1.1; // Adjust Y scale
         quantizedChart.options.scales.y.max = currentSettings.amplitude * 1.1;
        quantizedChart.update();
    }

    function updateReconstructedChart(originalData, reconstructedData) {
        const isDark = document.body.classList.contains('dark-mode');
        reconstructedChart.data.labels = originalData.map(p => p.x); // Use original x-axis
        reconstructedChart.data.datasets = [
            {
                label: 'Original Signal',
                data: originalData,
                borderColor: isDark ? 'rgba(200, 200, 200, 0.6)' : 'rgba(150, 150, 150, 0.6)',
                borderWidth: 1,
                pointRadius: 0,
                borderDash: [5, 5],
                tension: 0.1
            },
            {
                label: 'Reconstructed (ZOH)',
                data: reconstructedData,
                borderColor: isDark ? '#ffc107' : '#fd7e14', // Orange/Yellow for reconstructed
                borderWidth: 2,
                pointRadius: 0,
                stepped: false, // Already stepped data from ZOH implementation
                tension: 0 // Sharp corners
            }
        ];
        reconstructedChart.options = chartOptions('Reconstructed Signal vs Original', isDark);
         reconstructedChart.options.scales.y.min = -currentSettings.amplitude * 1.1; // Adjust Y scale
         reconstructedChart.options.scales.y.max = currentSettings.amplitude * 1.1;
        reconstructedChart.update();
    }


    // --- UI Update Functions ---
     function updateBinaryOutput(encodedData) {
        if (!encodedData || encodedData.length === 0) {
            binaryDataHeaderPre.textContent = '';
            binaryDataPre.textContent = '--- No data ---';
            return;
        }

        const bits = Math.log2(currentSettings.quantizationLevels);
        const numBits = Math.max(1, Math.ceil(bits)); // Ensure at least 1

        // Calculate maximum width needed for each column dynamically
        let maxSampleNumWidth = 'Sample'.length;
        let maxLevelWidth = 'Level'.length;
        let maxBinaryWidth = `Binary Code (${numBits} bits)`.length; // Initial width from header part

        encodedData.forEach(d => {
            maxSampleNumWidth = Math.max(maxSampleNumWidth, d.sampleNum.toString().length);
            maxLevelWidth = Math.max(maxLevelWidth, d.quantizedLevel.toString().length);
            // Binary width is fixed by numBits, but check header width just in case
            maxBinaryWidth = Math.max(maxBinaryWidth, d.binaryCode.length);
        });

         // Add padding for separators
         const col1Pad = maxSampleNumWidth + 1; // +1 space before '|'
         const col2Pad = maxLevelWidth + 1;   // +1 space before '|'
         const col3Pad = maxBinaryWidth;      // No padding needed after last column


        // Create header string with padding
        const header =
            'Sample'.padEnd(col1Pad) +
            '| ' + 'Level'.padEnd(col2Pad) +
            '| ' + `Binary Code (${numBits} bits)`.padEnd(col3Pad);

        binaryDataHeaderPre.textContent = header + '\n' + '-'.repeat(header.length); // Add separator line


        // Create data lines with padding
        const lines = encodedData.map(d => {
             const sampleStr = d.sampleNum.toString().padEnd(col1Pad);
             const levelStr = d.quantizedLevel.toString().padEnd(col2Pad);
             const binaryStr = d.binaryCode.padEnd(col3Pad); // Use padEnd for consistency if needed later
             return `${sampleStr}| ${levelStr}| ${binaryStr}`;
            }
        );

        binaryDataPre.textContent = lines.join('\n');
    }

    // --- Main Simulation Flow ---
    function generateAndDisplayOriginalSignal() {
         const analogSignal = generateAnalogSignal();
         updateOriginalChart(analogSignal);
         return analogSignal;
    }

    function runFullSimulation() {
        console.log("Running simulation with settings:", currentSettings);
        // 1. Generate Original Signal (or re-use if only PCM params changed)
        // Ensure analog signal is up-to-date if signal params changed just before PCM params
        const analogSignal = simulationData.analogSignal && simulationData.analogSignal.length > 0
                             ? simulationData.analogSignal
                             : generateAnalogSignal();
        // Always update the chart in case it wasn't updated by generateAndDisplayOriginalSignal
         updateOriginalChart(analogSignal);


        // 2. Sampling
        const sampledSignal = sampleSignal(analogSignal);
        updateSampledChart(analogSignal, sampledSignal);

        // 3. Quantization
        const quantizedSignal = quantizeSignal(sampledSignal);
        updateQuantizedChart(sampledSignal, quantizedSignal);

        // 4. Encoding
        const encodedData = encodeSignal(quantizedSignal);
        updateBinaryOutput(encodedData);

        // 5. Reconstruction
        const reconstructedSignal = reconstructSignal(quantizedSignal);
        updateReconstructedChart(analogSignal, reconstructedSignal);

        // 6. Analysis
        calculateSNR();

        console.log("Simulation complete.");
    }

    // --- Reset Function ---
    function resetSimulation() {
        currentSettings = { ...defaultSettings };

        // Reset UI elements to default values
        // signalTypeSelect removed
        amplitudeSlider.value = defaultSettings.amplitude;
        frequencySlider.value = defaultSettings.frequency;
        phaseSlider.value = defaultSettings.phase;
        durationSlider.value = defaultSettings.duration;
        samplingRateSlider.value = defaultSettings.samplingRate;
        quantizationLevelsSelect.value = defaultSettings.quantizationLevels;

        updateDisplays(); // Update text spans

        // Clear outputs explicitly
        binaryDataHeaderPre.textContent = '';
        binaryDataPre.textContent = '---';
        quantizationErrorInfoSpan.textContent = 'Quantization Error (Approx. MSE): N/A';
        snrInfoSpan.textContent = 'Estimated SNR: N/A dB';

        // Re-run simulation with defaults
        initializeCharts(); // Re-create charts to clear them properly
        runFullSimulation();
    }

     // --- Theme Toggle ---
     function toggleTheme() {
        document.body.classList.toggle('dark-mode');
        // Re-initialize charts with the new theme settings
        initializeCharts();
        // Re-run simulation to apply theme to charts
        runFullSimulation();
     }


    // --- Initial Setup ---
    setupEventListeners();
    toggleTheme();

}); // End DOMContentLoaded