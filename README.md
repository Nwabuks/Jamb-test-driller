# JAMB Test Driller 🎓

A comprehensive JAMB (Joint Admissions and Matriculation Board) simulation test driller application with performance analytics.

## Features ✨

- **JAMB Simulation**: Realistic exam mode with timer and subject combinations
- **Multiple Subjects**: Choose up to 4 JAMB subjects (English optional)
- **Question Bank**: Built-in questions for all JAMB subjects
- **Custom Quizzes**: Create quizzes with specific question counts per subject
- **Performance Analytics**: 
  - Progress tracking over time
  - Subject comparison charts
  - Strengths & weaknesses analysis
- **Exam Mode**: Full-screen simulation with navigation restrictions
- **Results Review**: Detailed review with explanations

## How to Use 📖

1. **Setup**: Select your subjects (up to 4) and timer settings
2. **Upload**: Add your own questions via JSON (optional - built-in questions included)
3. **Quiz**: Start a full JAMB simulation or practice individual subjects
4. **Results**: View detailed results and performance analytics

## Technical Details 🛠️

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Charts**: Chart.js for performance analytics
- **Storage**: Local Storage for saving progress
- **Icons**: Font Awesome 6.4.0
- **Responsive**: Mobile-friendly design

## Question Format 📝

Add your own questions using this JSON format:
```json
{
    "subject": "english",
    "questions": [
        {
            "question": "Your question here?",
            "options": ["Option A", "Option B", "Option C", "Option D"],
            "correctAnswer": 0,
            "explanation": "Explanation here"
        }
    ]
}