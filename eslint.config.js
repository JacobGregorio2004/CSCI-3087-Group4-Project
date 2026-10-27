module.exports = [
    {
        files: ["js/budgetCalculator.js", "tests/budgetCalculator.test.js"],
        languageOptions: {
            sourceType: "commonjs"
        },
        rules: {
            "no-undef": "error",
            "no-unused-vars": "error"
        }
    }
];
