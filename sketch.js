// Your Teachable Machine model URL (loaded via UI)
let modelURL = '';

const catImages = [];
const dogImages = [];

let currentCatIndex = 0;
let currentDogIndex = 0;

// Populate cat images (8497-8600)
for (let i = 8497; i <= 8600; i++) {
    catImages.push(`test_images/MoreImages_Catszip/${i}.jpg`);
}

// Populate dog images (784-887)
for (let i = 784; i <= 887; i++) {
    dogImages.push(`test_images/MoreSamplesDogs/${i}.jpg`);
}

let testData = [];

let classifier;              // ml5 image classifier
let images = [];             // Array to store loaded images
let results = [];            // Array to store classification results
let modelLoaded = false;     // Flag to track if model is loaded
let allClassified = false;   // Flag to track if all images are classified
let correctCount = 0;        // Counter for correct predictions

// Layout configuration
const COLUMNS = 5;           // Number of columns in the grid
const IMAGE_SIZE = 140;      // Size of each displayed image
const PADDING = 35;          // Padding between images
const HEADER_HEIGHT = 120;   // Space for header/summary
const BG_COLOR = '#e8f0fe';  // Background color
const PRIMARY_COLOR = '#1967d2'; // Primary blue color
const BORDER_RADIUS = 9;     // Border radius for cards

// Font variables
let poppinsRegular;
let poppinsBold;
let isModelLoaded = false;
let modelReadyCallback = null;
let hoveredIndex = -1;  // Track which image is being hovered

// Function to generate sequential test data
function generateTestData() {
    testData = [];
    images = [];
    results = [];
    correctCount = 0;
    allClassified = false;
    
    const selectedCats = [];
    const selectedDogs = [];
    
    const catsRemaining = catImages.length - currentCatIndex;
    const catsToShow = Math.min(5, catsRemaining);
    
    for (let i = 0; i < catsToShow; i++) {
        selectedCats.push(catImages[currentCatIndex + i]);
    }
    currentCatIndex += catsToShow;
    
    // Reset if we've shown all cats
    if (currentCatIndex >= catImages.length) {
        console.log('All cat images shown, resetting to start...');
        currentCatIndex = 0;
    }
    
    const dogsRemaining = dogImages.length - currentDogIndex;
    const dogsToShow = Math.min(5, dogsRemaining);
    
    for (let i = 0; i < dogsToShow; i++) {
        selectedDogs.push(dogImages[currentDogIndex + i]);
    }
    currentDogIndex += dogsToShow;
    
    // Reset if we've shown all dogs
    if (currentDogIndex >= dogImages.length) {
        console.log('All dog images shown, resetting to start...');
        currentDogIndex = 0;
    }
    
    const combined = [
        ...selectedCats.map(path => ({ imagePath: path, actualLabel: 'Cat' })),
        ...selectedDogs.map(path => ({ imagePath: path, actualLabel: 'Dog' }))
    ];
    
    // Keep them in order
    testData = combined;
    
    // Initialize results array
    for (let i = 0; i < testData.length; i++) {
        results.push(null);
    }
}

function setup() {
    createCanvas(windowWidth, windowHeight);
    textFont('Poppins');
    setupUI();
}

function setupUI() {
    const modelInput = document.getElementById('modelInput');
    const loadBtn = document.getElementById('loadModelBtn');
    const navigationButtons = document.getElementById('navigationButtons');
    const backBtn = document.getElementById('backBtn');
    const nextBtn = document.getElementById('nextBtn');
    
    loadBtn.addEventListener('click', () => {
        const enteredURL = modelInput.value.trim();
        if (enteredURL) {
            modelURL = enteredURL;
            loadBtn.textContent = 'LOADING...';
            loadBtn.disabled = true;
            
            // Format URL
            let formattedURL = modelURL.trim();
            if (formattedURL.endsWith('model.json')) {
                formattedURL = formattedURL.replace(/model\.json$/, '');
            }
            if (!formattedURL.endsWith('/')) {
                formattedURL += '/';
            }
            
            try {
                console.log('Loading model from:', formattedURL + 'model.json' + '?v=' + new Date().getTime());
                
                // Load classifier
                classifier = ml5.imageClassifier(formattedURL + 'model.json' + '?v=' + new Date().getTime());
                
                // Fetch metadata to get labels
                httpGet(formattedURL + 'metadata.json', 'json', false, (response) => {
                    console.log('Metadata loaded:', response);
                    
                    loadBtn.textContent = 'MODEL LOADED';
                    setTimeout(() => {
                        loadBtn.textContent = 'REFRESH MODEL';
                        loadBtn.disabled = false;
                    }, 2000);
                    
                    modelLoaded = true;
                    isModelLoaded = true;
                    
                    currentCatIndex = 0;
                    currentDogIndex = 0;
                    
                    // Generate test data and load images
                    generateTestData();
                    loadImages();
                    
                }, (error) => {
                    console.error('Metadata loading error:', error);
                    loadBtn.textContent = 'ERROR LOADING';
                    loadBtn.disabled = false;
                    alert('Invalid Teachable Machine URL');
                });
                
            } catch (e) {
                console.error('Error:', e);
                loadBtn.textContent = 'ERROR';
                loadBtn.disabled = false;
            }
        } else {
            alert('Please enter a valid Teachable Machine model URL');
        }
    });
    
    backBtn.addEventListener('click', () => {
        if (isModelLoaded && modelLoaded) {
            backBtn.disabled = true;
            nextBtn.disabled = true;
            
            // Go back 10 images (5 cats + 5 dogs)
            currentCatIndex = Math.max(0, currentCatIndex - 10);
            currentDogIndex = Math.max(0, currentDogIndex - 10);
            
            generateTestData();
            loadImages();
            redraw();
        }
    });
    
    nextBtn.addEventListener('click', () => {
        if (isModelLoaded && modelLoaded) {
            backBtn.disabled = true;
            nextBtn.disabled = true;
            generateTestData();
            loadImages();
            redraw();
        }
    });
}

function loadImages() {
    let loadedCount = 0;
    
    // Load each image from testData
    for (let i = 0; i < testData.length; i++) {
        const currentIndex = i; // Capture index for callbacks
        
        loadImage(
            testData[currentIndex].imagePath,
            (img) => {
                // Success callback - preprocess to match TM's center crop
                images[currentIndex] = preprocessImageForTM(img);
                loadedCount++;
                
                // When all images are loaded, start classification
                if (loadedCount === testData.length) {
                    console.log('All images loaded!');
                    classifyAllImages();
                }
            },
            (err) => {
                // Error callback - create placeholder
                console.error(`Failed to load ${testData[currentIndex].imagePath}`, err);
                images[currentIndex] = createPlaceholderImage(testData[currentIndex].actualLabel);
                loadedCount++;
                
                if (loadedCount === testData.length) {
                    console.log('All images processed (some with placeholders)!');
                    classifyAllImages();
                }
            }
        );
    }
}

// Create a placeholder image if actual image fails to load
function createPlaceholderImage(label) {
    let img = createGraphics(IMAGE_SIZE, IMAGE_SIZE);
    img.background(200);
    img.fill(100);
    img.textSize(16);
    img.textAlign(CENTER, CENTER);
    img.text(`Placeholder\n${label}`, IMAGE_SIZE / 2, IMAGE_SIZE / 2);
    return img;
}

// Preprocess image to match Teachable Machine's center crop behavior
function preprocessImageForTM(img) {
    // Teachable Machine uses 224x224 center-cropped square images
    const targetSize = 224;
    
    let processedImg = createGraphics(targetSize, targetSize);
    
    // Determine the crop dimensions (center square of original image)
    let cropSize = Math.min(img.width, img.height);
    let cropX = (img.width - cropSize) / 2;
    let cropY = (img.height - cropSize) / 2;
    
    // Draw the center-cropped image
    processedImg.image(img, 0, 0, targetSize, targetSize, cropX, cropY, cropSize, cropSize);
    
    return processedImg;
}

function classifyAllImages() {
    let classifiedCount = 0;
    
    function classifyNext(index) {
        if (index >= images.length) {
            return;
        }
        
        classifier.classify(images[index], (error, classifications) => {
            if (error) {
                console.error('Classification error at index', index, ':', error);
                results[index] = { error: true };
            } else if (!classifications || classifications.length === 0) {
                console.error('No classifications returned for index', index);
                results[index] = { error: true };
            } else {
                console.log('Classification', index, ':', classifications[0]);
                
                // Convert class labels to readable format
                let prediction = classifications[0];
                const labelLower = prediction.label.toLowerCase();
                
                // Map class 1/class1 to Cat, class 2/class2 to Dog
                if (labelLower === 'class 1' || labelLower === 'class1') {
                    prediction = { label: 'Cat', confidence: prediction.confidence };
                } else if (labelLower === 'class 2' || labelLower === 'class2') {
                    prediction = { label: 'Dog', confidence: prediction.confidence };
                }
                
                // Store the top prediction with converted label
                results[index] = prediction;
                
                // Check if prediction is correct (labels are now normalized)
                const predictedLabel = prediction.label;
                const actualLabel = testData[index].actualLabel;
                
                if (predictedLabel === actualLabel) {
                    correctCount++;
                }
            }
            
            classifiedCount++;
            
            // When all images are classified, trigger redraw
            if (classifiedCount === images.length) {
                console.log('All images classified!');
                allClassified = true;
                
                // Check if accuracy is suspiciously low (0 matches)
                if (correctCount === 0) {
                    alert('Warning: 0 matches detected!\n\nPlease check if your model was trained correctly.\n\nExpected labels:\n• "Cat" (or "Class 1") for cat images\n• "Dog" (or "Class 2") for dog images');
                }
                
                // Show and enable navigation buttons
                const navigationButtons = document.getElementById('navigationButtons');
                const backBtn = document.getElementById('backBtn');
                const nextBtn = document.getElementById('nextBtn');
                navigationButtons.style.display = 'flex';
                
                // Enable back button only if we're not at the start
                backBtn.disabled = (currentCatIndex <= 5 && currentDogIndex <= 5);
                nextBtn.disabled = false;
                
                redraw();
            } else {
                // Classify next image
                classifyNext(index + 1);
            }
        });
    }
    
    // Start classifying from index 0
    classifyNext(0);
}

function draw() {
    background(BG_COLOR);
    
    // Show welcome message if model not loaded yet
    if (!isModelLoaded) {
        fill(PRIMARY_COLOR);
        textSize(24);
        textStyle(BOLD);
        textAlign(CENTER, CENTER);
        text('Teachable Machine Tester', width / 2, HEADER_HEIGHT / 2);
        
        textSize(16);
        textStyle(NORMAL);
        fill(100);
        text('Enter your model URL above and click LOAD MODEL to begin', width / 2, HEADER_HEIGHT / 2 + 40);
        return;
    }
    
    // Only draw results when all classifications are complete
    if (!allClassified) {
        if (isModelLoaded) {
            // Show loading state
            fill(PRIMARY_COLOR);
            textSize(20);
            textStyle(BOLD);
            textAlign(CENTER, CENTER);
            text('Loading and classifying images...', width / 2, height / 2);
        }
        return;
    }
    
    drawHeader();
    drawResultsGrid();
    noLoop();
}

function drawHeader() {
    // Title
    fill(PRIMARY_COLOR);
    textSize(28);
    textStyle(BOLD);
    textAlign(CENTER, TOP);
    text('Teachable Machine Tester', width / 2, 25);
    
    // Summary statistics card
    textStyle(NORMAL);
    textSize(18);
    const accuracy = (correctCount / testData.length * 100).toFixed(1);
    
    // Draw stats background card
    fill(255);
    noStroke();
    rectMode(CENTER);
    const cardWidth = 500;
    const cardHeight = 50;
    rect(width / 2, 80, cardWidth, cardHeight, BORDER_RADIUS);
    
    // Draw stats text (centered vertically)
    fill(PRIMARY_COLOR);
    textStyle(BOLD);
    textAlign(CENTER, CENTER);
    const summaryText = `Total: ${testData.length}  |  Correct: ${correctCount}  |  Accuracy: ${accuracy}%`;
    text(summaryText, width / 2, 80);
}

function mouseMoved() {
    if (!allClassified) return;
    
    // Calculate grid layout
    const totalWidth = COLUMNS * (IMAGE_SIZE + PADDING) - PADDING;
    const startX = (width - totalWidth) / 2;
    
    hoveredIndex = -1;
    
    // Check if mouse is over any image
    for (let i = 0; i < testData.length; i++) {
        const col = i % COLUMNS;
        const row = Math.floor(i / COLUMNS);
        const x = startX + col * (IMAGE_SIZE + PADDING);
        const y = HEADER_HEIGHT + 20 + row * (IMAGE_SIZE + PADDING + 90);
        
        // Check if mouse is within image bounds
        if (mouseX >= x && mouseX <= x + IMAGE_SIZE &&
            mouseY >= y && mouseY <= y + IMAGE_SIZE) {
            hoveredIndex = i;
            break;
        }
    }
    
    // Redraw to show/hide filename
    if (allClassified) {
        redraw();
    }
}

function drawResultsGrid() {
    // Center the grid (adjust for actual number of images)
    const numImages = testData.length;
    const actualColumns = Math.min(COLUMNS, numImages);
    const totalWidth = actualColumns * (IMAGE_SIZE + PADDING) - PADDING;
    const startX = (width - totalWidth) / 2;
    
    for (let i = 0; i < testData.length; i++) {
        // Calculate grid position
        const col = i % COLUMNS;
        const row = Math.floor(i / COLUMNS);
        const x = startX + col * (IMAGE_SIZE + PADDING);
        const y = HEADER_HEIGHT + 20 + row * (IMAGE_SIZE + PADDING + 90);
        
        // Draw image with border
        drawImageWithBorder(images[i], x, y, i);
        
        // Draw prediction text
        drawPredictionText(x, y + IMAGE_SIZE + 10, i);
        
        // Draw filename tooltip if hovering
        if (hoveredIndex === i) {
            drawFilenameTooltip(x, y, i);
        }
    }
}

function drawImageWithBorder(img, x, y, index) {
    const result = results[index];
    const actualLabel = testData[index].actualLabel;
    
    // Determine border color (green if correct, red if incorrect)
    let isCorrect = false;
    if (result && !result.error) {
        isCorrect = result.label === actualLabel;
    }
    
    const glowColor = isCorrect ? color(0, 200, 0) : color(255, 50, 50);
    
    // Draw outer glow effect (multiple layers for smooth glow)
    push(); // Save drawing state
    noFill();
    rectMode(CORNER);
    
    // Outer glow layers
    for (let i = 3; i >= 0; i--) {
        strokeWeight(2);
        let alpha = 30 - (i * 7);
        stroke(red(glowColor), green(glowColor), blue(glowColor), alpha);
        rect(x - 3 - i*2, y - 3 - i*2, IMAGE_SIZE + 6 + i*4, IMAGE_SIZE + 6 + i*4, BORDER_RADIUS + i);
    }
    pop(); // Restore drawing state
    
    // Draw image
    push();
    noStroke();
    noTint();
    image(img, x, y, IMAGE_SIZE, IMAGE_SIZE);
    pop();
    
    // Draw colored border on top of image (thicker)
    push();
    strokeWeight(6);
    stroke(glowColor);
    noFill();
    rectMode(CORNER);
    rect(x - 3, y - 3, IMAGE_SIZE + 6, IMAGE_SIZE + 6, BORDER_RADIUS);
    pop();
}

function drawFilenameTooltip(x, y, index) {
    // Extract just the filename from the path
    const fullPath = testData[index].imagePath;
    const filename = fullPath.split('/').pop();
    
    push();
    
    // Measure text to size tooltip
    textSize(12);
    textStyle(NORMAL);
    const textW = textWidth(filename);
    const tooltipW = textW + 16;
    const tooltipH = 28;
    const tooltipX = x + IMAGE_SIZE / 2;
    const tooltipY = y - 10;
    
    // Draw tooltip background
    fill(50, 50, 50, 230);
    noStroke();
    rectMode(CENTER);
    rect(tooltipX, tooltipY, tooltipW, tooltipH, 4);
    
    // Draw small triangle pointer
    triangle(
        tooltipX - 5, tooltipY + tooltipH / 2,
        tooltipX + 5, tooltipY + tooltipH / 2,
        tooltipX, tooltipY + tooltipH / 2 + 5
    );
    
    // Draw filename text
    fill(255);
    textAlign(CENTER, CENTER);
    text(filename, tooltipX, tooltipY);
    
    pop();
}

function drawPredictionText(x, y, index) {
    const result = results[index];
    const actualLabel = testData[index].actualLabel;
    
    textAlign(CENTER, TOP);
    textStyle(NORMAL);
    textSize(13);
    
    // Display actual label
    fill(100);
    text(`Actual: ${actualLabel}`, x + IMAGE_SIZE / 2, y);
    
    // Display prediction
    if (result && !result.error) {
        const confidence = (result.confidence * 100).toFixed(1);
        fill(PRIMARY_COLOR);
        textStyle(BOLD);
        text(`${result.label}`, x + IMAGE_SIZE / 2, y + 18);
        textStyle(NORMAL);
        fill(100);
        text(`${confidence}% confidence`, x + IMAGE_SIZE / 2, y + 36);
    } else {
        fill(255, 0, 0);
        textStyle(BOLD);
        text('Error', x + IMAGE_SIZE / 2, y + 18);
    }
}
