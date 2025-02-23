#!/bin/bash

# Set up error handling
set -e  # Exit on error
FAILED_TESTS=()

# Function to run test and capture both output and errors
run_test() {
    local TEST_TYPE=$1
    local OUTPUT
    local EXIT_CODE

    echo "Running $TEST_TYPE test..."

    # Run node and capture both output and exit code
    if ! OUTPUT=$(node index.js 2>&1); then
        echo "❌ $TEST_TYPE test failed with error:"
        echo "$OUTPUT"
        FAILED_TESTS+=("$TEST_TYPE")
        return 1
    fi

    echo "$OUTPUT"  # Display the output

    # Only validate output if execution succeeded
    if ! validate_test_output "$OUTPUT" "$TEST_TYPE"; then
        FAILED_TESTS+=("$TEST_TYPE")
        return 1
    fi

    echo "✅ $TEST_TYPE test passed"
    return 0
}

# Function to validate test output
validate_test_output() {
    local OUTPUT=$1
    local TEST_TYPE=$2
    local EXPECTED_INITIAL="$TEST_TYPE Test - Count: 0"
    local EXPECTED_FINAL="$TEST_TYPE Test - Count: 1"

    if [[ $OUTPUT != *"$EXPECTED_INITIAL"* ]]; then
        echo "❌ $TEST_TYPE validation failed: Missing initial output"
        echo "Expected: $EXPECTED_INITIAL"
        return 1
    fi

    if [[ $OUTPUT != *"$EXPECTED_FINAL"* ]]; then
        echo "❌ $TEST_TYPE validation failed: Missing final output"
        echo "Expected: $EXPECTED_FINAL"
        return 1
    fi

    return 0
}

# Clean up previous test directories
rm -rf test-reflex
rm -f *.tgz

# Build and pack the package
echo "📦 Building and packing package..."
npm run local:pack

# Get the name of the generated tarball
PACKAGE=$(ls *.tgz)
echo "📄 Using package: $PACKAGE"

# Create test directory
mkdir -p test-reflex
cd test-reflex

# Test ESM
echo -e "\n🔍 Testing ESM..."
mkdir esm-test
cd esm-test
npm init -y > /dev/null 2>&1
npm pkg set type=module > /dev/null 2>&1
npm install ../../$PACKAGE > /dev/null 2>&1

cat > index.js << 'EOF'
import { reflex } from "@2toad/reflex";

const count = reflex({ initialValue: 0 });
count.subscribe(value => console.log("ESM Test - Count:", value));
count.setValue(1);
EOF

run_test "ESM"
cd ..

# Test CommonJS
echo -e "\n🔍 Testing CommonJS..."
mkdir cjs-test
cd cjs-test
npm init -y > /dev/null 2>&1
npm install ../../$PACKAGE > /dev/null 2>&1

cat > index.js << 'EOF'
const { reflex } = require("@2toad/reflex");

const count = reflex({ initialValue: 0 });
count.subscribe(value => console.log("CJS Test - Count:", value));
count.setValue(1);
EOF

run_test "CJS"

# Return to root directory
cd ../..

# Report final status
echo -e "\n📋 Test Summary:"
if [ ${#FAILED_TESTS[@]} -eq 0 ]; then
    echo "✅ All package tests passed!"
else
    echo "❌ Failed tests: ${FAILED_TESTS[*]}"
    echo "Test files are in ./test-reflex/ for inspection"
    exit 1
fi

# Prompt for cleanup
echo -e "\n\n🧹 Cleaning up test files..."
rm -rf test-reflex
rm -f *.tgz
echo "✨ Cleanup complete."
