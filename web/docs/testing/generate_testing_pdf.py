#!/usr/bin/env python3
"""Generate a styled PDF of miniCycle feature testing directions."""

import os

from fpdf import FPDF

class TestingPDF(FPDF):
    def header(self):
        pass

    def footer(self):
        self.set_y(-15)
        self.set_font('Helvetica', 'I', 8)
        self.set_text_color(150, 150, 150)
        self.cell(0, 10, f'Page {self.page_no()}/{{nb}}', align='C')

    def section_title(self, title):
        self.set_font('Helvetica', 'B', 14)
        self.set_text_color(30, 30, 30)
        self.cell(0, 10, title, new_x="LMARGIN", new_y="NEXT")
        self.set_draw_color(70, 130, 230)
        self.set_line_width(0.8)
        self.line(self.l_margin, self.get_y(), self.w - self.r_margin, self.get_y())
        self.ln(4)

    def sub_section(self, title):
        self.set_font('Helvetica', 'B', 12)
        self.set_text_color(50, 50, 50)
        self.cell(0, 8, title, new_x="LMARGIN", new_y="NEXT")
        self.ln(2)

    def body_text(self, text):
        self.set_font('Helvetica', '', 10)
        self.set_text_color(50, 50, 50)
        self.multi_cell(0, 5.5, text)
        self.ln(2)

    def bold_text(self, text):
        self.set_font('Helvetica', 'B', 10)
        self.set_text_color(50, 50, 50)
        self.multi_cell(0, 5.5, text)
        self.ln(2)

    def step(self, number, text):
        self.set_font('Helvetica', 'B', 10)
        self.set_text_color(70, 130, 230)
        x = self.get_x()
        y = self.get_y()
        num_w = 8
        self.cell(num_w, 5.5, f'{number}.')
        self.set_font('Helvetica', '', 10)
        self.set_text_color(50, 50, 50)
        self.multi_cell(0, 5.5, text)
        self.ln(1)

    def feedback_box(self, text):
        self.ln(2)
        self.set_fill_color(240, 245, 255)
        self.set_draw_color(70, 130, 230)
        x = self.get_x()
        y = self.get_y()
        self.set_font('Helvetica', 'I', 9.5)
        self.set_text_color(60, 60, 80)
        # Calculate height needed
        self.set_x(x + 4)
        w = self.w - self.l_margin - self.r_margin - 8
        self.multi_cell(w, 5, text, border=0)
        h = self.get_y() - y + 4
        # Draw the box behind
        self.set_y(y)
        self.set_x(x)
        self.rect(x, y - 1, self.w - self.l_margin - self.r_margin, h, style='DF')
        # Rewrite text on top
        self.set_y(y + 1)
        self.set_x(x + 4)
        self.set_text_color(60, 60, 80)
        self.multi_cell(w, 5, text, border=0)
        self.ln(4)


def create_pdf():
    pdf = TestingPDF()
    pdf.alias_nb_pages()
    pdf.set_auto_page_break(auto=True, margin=20)
    pdf.add_page()

    # Title
    pdf.set_font('Helvetica', 'B', 22)
    pdf.set_text_color(30, 30, 30)
    pdf.cell(0, 12, 'miniCycle', align='C', new_x="LMARGIN", new_y="NEXT")
    pdf.set_font('Helvetica', '', 14)
    pdf.set_text_color(100, 100, 100)
    pdf.cell(0, 8, 'Feature Testing Directions', align='C', new_x="LMARGIN", new_y="NEXT")
    pdf.ln(4)
    pdf.set_draw_color(70, 130, 230)
    pdf.set_line_width(0.5)
    mid = pdf.w / 2
    pdf.line(mid - 40, pdf.get_y(), mid + 40, pdf.get_y())
    pdf.ln(8)

    # Setup
    pdf.body_text(
        'Thank you for reviewing miniCycle! Please test the following features in order '
        'and share your thoughts on each.'
    )
    pdf.bold_text(
        'Setup: Open the app at minicycle.app. Make sure you are in Auto-Cycle mode '
        '(check the mode selector in the header -- it should say "Auto Cycle"). '
        'You should see a routine with a few tasks. If not, tap the + button in the '
        'top-left to add 3-4 tasks (e.g., "Exercise", "Read", "Meditate", "Journal").'
    )
    pdf.ln(2)

    # Test 1
    pdf.section_title('Test 1: Show Completed in Dropdown')
    pdf.step(1, 'Open the menu (hamburger icon, top-right)')
    pdf.step(2, 'Go to Settings & Personalization > Settings')
    pdf.step(3, 'Under the Display section, toggle on "Show Completed in Dropdown"')
    pdf.step(4, 'Close Settings and the menu')
    pdf.step(5, 'Now check off 2 of your tasks by tapping their checkboxes')
    pdf.step(6, 'Notice the completed tasks move into a "Completed (2)" section below your remaining tasks')
    pdf.step(7, 'Tap the "Completed" header to collapse it -- the completed tasks hide away')
    pdf.step(8, 'Tap it again to expand and see them')
    pdf.step(9, 'Try unchecking a task from inside the completed section -- it should move back to the main list')
    pdf.feedback_box(
        'Share your thoughts: Was the completed dropdown easy to understand? Is the expand/collapse '
        'behavior clear? Do you prefer completed tasks separated like this or mixed into the main list?'
    )

    # Test 2a
    pdf.section_title('Test 2a: Setting Up a Recurring Task')
    pdf.step(1, 'Hover over or tap on any task to reveal the task option buttons (small icons that appear on the task)')
    pdf.step(2, 'Look for the -/+ button on the task options and tap it -- this opens the Customize Task Options modal')
    pdf.step(3, 'In the modal, check the box next to "Recurring Task" to enable it, then close the modal')
    pdf.step(4, 'You should now see a recurring icon (circular arrows) on each task\'s option buttons')
    pdf.step(5, 'Tap the recurring icon on any task')
    pdf.step(6, 'A notification confirms the task is set to recurring daily (indefinitely)')
    pdf.step(7, 'Tap the lightbulb icon on the notification to toggle the explanation tooltip -- it explains how recurring tasks work with cycle resets')
    pdf.step(8, 'Tap "Change Settings" on the notification to see the quick schedule options (Hourly, Daily, Weekly, Monthly) and a "More Options" button for advanced settings')
    pdf.step(9, 'Notice the recurring icon now appears next to that task\'s name, and a small info link appears below the task list showing how many tasks are set to recurring')
    pdf.step(10, 'Now complete all tasks to finish a cycle -- the progress bar fills up, the recurring task gets removed with a checkmark animation, and the cycle resets')
    pdf.feedback_box(
        'Share your thoughts: Was enabling the recurring option straightforward? Was the recurring button '
        'easy to find and understand? Was the lightbulb tooltip helpful? Did the notification with schedule '
        'options make sense?'
    )

    # Test 2b
    pdf.section_title('Test 2b: Recurring Tasks Panel')
    pdf.step(11, 'Open the menu (hamburger icon, top-right) and expand Task Actions & Features, then tap "Recurring"')
    pdf.step(12, 'In the Recurring Tasks panel, tap on the recurring task to see its schedule details -- it shows when it\'s set to repeat, when it will next appear, and a "Change Recurring Settings" button')
    pdf.step(13, 'Tap "Add Task to Recurring" -- a list of your non-recurring tasks appears with checkboxes')
    pdf.step(14, 'Tap "Select All" to select all available tasks, then confirm to add them all to recurring')
    pdf.step(15, 'All tasks should now appear in the recurring list highlighted in green')
    pdf.step(16, 'Select all tasks using the "Check All" button at the top of the list')
    pdf.step(17, 'Tap "Change Recurring Settings" -- the schedule editor appears')
    pdf.step(18, 'Tap "Show Advanced Options" to expand the advanced settings')
    pdf.step(19, 'Check "Choose specific time of day" -- a time picker appears with Hour, Minute, and AM/PM fields')
    pdf.step(20, 'Set the time to 2 minutes from now (check your current time and make sure you select the correct AM/PM), then tap "Apply"')
    pdf.step(21, 'Close the Recurring Tasks panel')
    pdf.step(22, 'Now complete all tasks to finish a cycle -- all tasks are removed (since they\'re all recurring) and the task list shows "No tasks yet" with a note showing how many tasks are set to recurring')
    pdf.step(23, 'Wait about 2 minutes -- the recurring tasks should automatically reappear in your task list on schedule')
    pdf.feedback_box(
        'Share your thoughts: Was the Recurring Tasks panel useful for managing tasks? Were the Add Task to '
        'Recurring flow and Select All intuitive? Was setting a specific time easy? Did the tasks reappear '
        'on schedule as expected?'
    )

    # Test 3
    pdf.section_title('Test 3: Download and Import a Routine')
    pdf.step(1, 'Open the menu (hamburger icon, top-right)')
    pdf.step(2, 'Under Routine Actions, tap Download')
    pdf.step(3, 'A .mcyc file should download to your device (usually saves to your Downloads folder)')
    pdf.step(4, 'Now open the menu again and under Routine Actions, tap Import')
    pdf.step(5, 'Select the .mcyc file you just downloaded')
    pdf.step(6, 'The imported routine should load -- you can find it by tapping the folder icon in the header to open the routine switcher')
    pdf.step(7, 'Verify the imported routine has all the same tasks as the original')
    pdf.feedback_box(
        'Share your thoughts: Was the Download and Import easy to find? Was the process clear? '
        'Did the routine come through correctly with all tasks intact?'
    )

    # General Questions
    pdf.section_title('General Questions')
    pdf.body_text('-  On a scale of 1-10, how intuitive was each feature?')
    pdf.body_text('-  Anything that surprised you or felt out of place?')
    pdf.body_text('-  Any features you wish worked differently?')

    output_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'miniCycle_Testing_Directions.pdf')
    pdf.output(output_path)
    return output_path


if __name__ == '__main__':
    path = create_pdf()
    print(f'PDF created: {path}')
