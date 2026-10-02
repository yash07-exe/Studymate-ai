import csv
import os
import re

# Looks for assignments.csv in the same folder as this file
CSV_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "assignments.csv")
# CSV columns: student_name, subject, total_assignments, completed, remaining


def chatbot(question, csv_file=CSV_FILE):
    """One function that answers student and teacher questions about assignments."""
    q = question.lower().strip()

    with open(csv_file, newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    for r in rows:
        r["completed"] = int(r["completed"])
        r["remaining"] = int(r["remaining"])
        r["total"] = int(r["total_assignments"])

    # Find a student name mentioned in the question
    student = next((r for r in rows
                    if re.search(r"\b" + re.escape(r["student_name"].lower()) + r"\b", q)), None)

    # ---- Questions about one student ----
    if student:
        n = student["student_name"]
        if "pending" in q or "remaining" in q or "left" in q or "not done" in q:
            return f"{n} has {student['remaining']} assignment(s) remaining."
        if "completed" in q or "done" in q or "finished" in q or "submitted" in q:
            return f"{n} has completed {student['completed']} assignment(s)."
        return (f"{n} ({student['subject']}): {student['completed']} completed, "
                f"{student['remaining']} remaining out of {student['total']}.")

    # ---- Teacher questions about the whole class ----
    if "who" in q and ("pending" in q or "remaining" in q or "not" in q):
        lst = [f"{r['student_name']} ({r['remaining']})" for r in rows if r["remaining"] > 0]
        return "Students with pending work: " + (", ".join(lst) or "nobody, all done!")

    if "most" in q or "top" in q:
        best = max(rows, key=lambda r: r["completed"])
        return f"{best['student_name']} has completed the most: {best['completed']} of {best['total']}."

    if "least" in q or "lowest" in q:
        low = min(rows, key=lambda r: r["completed"])
        return f"{low['student_name']} has completed the least: {low['completed']} of {low['total']}."

    if "who" in q and ("completed" in q or "all" in q or "finished" in q):
        lst = [r["student_name"] for r in rows if r["remaining"] == 0]
        return "Students who finished everything: " + (", ".join(lst) or "nobody yet.")

    if "class" in q or "all" in q or "summary" in q or "total" in q or "everyone" in q:
        c = sum(r["completed"] for r in rows)
        rem = sum(r["remaining"] for r in rows)
        return (f"Class summary: {len(rows)} students, {c} completed, {rem} remaining, "
                f"{c + rem} assignments in total.")

    return ("Sorry, I didn't get that. Try: 'How many assignments has Aman completed?', "
            "'How many are remaining for Arman?', 'Who has pending assignments?', "
            "'Who has completed the most?' or 'Class summary'.")


if __name__ == "__main__":
    print("Assignment Chatbot (type 'exit' to quit)")
    while True:
        text = input("You: ")
        if text.strip().lower() in ("exit", "quit"):
            break
        print("Bot:", chatbot(text))