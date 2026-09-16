"""
What goes into each project's Power BI template.

Kept apart from build_pbit.py because the builder is mechanical and this is editorial: which
tables, which relationships, which measures are worth having, and what the report says. The
pages are written for Power BI rather than copied from the web dashboards, because a report
with pages and a slicer is a different medium from a single scrolling page.
"""

from build_pbit import visual, textbox

# Roles, by visual type, for reference while editing below:
#   card                Values
#   clusteredBarChart   Category, Y
#   clusteredColumnChart Category, Series, Y
#   pivotTable          Rows, Columns, Values
#   tableEx             Values

M = "_Measures"


def card(x, y, w, h, measure, title):
    return visual(x, y, w, h, "card", [("Values", M, measure, True)], title)


LUMEN_MEASURES = [
    # ---- money
    {"name": "Billed", "dax": "SUM ( fct_appointment[billed_zar] )",
     "format": '"R"#,##0',
     "note": "Everything invoiced for care that was actually delivered."},
    {"name": "Scheme Paid", "dax": "SUM ( fct_appointment[scheme_paid_zar] )",
     "format": '"R"#,##0'},
    {"name": "Scheme Shortfall", "dax": "SUM ( fct_appointment[scheme_shortfall_zar] )",
     "format": '"R"#,##0',
     "note": "Claimed and not paid. Rejected or short paid, and never recovered."},
    {"name": "Patient Due", "dax": "SUM ( fct_appointment[patient_due_zar] )",
     "format": '"R"#,##0'},
    {"name": "Patient Paid", "dax": "SUM ( fct_appointment[patient_paid_zar] )",
     "format": '"R"#,##0'},
    {"name": "Patient Shortfall", "dax": "[Patient Due] - [Patient Paid]",
     "format": '"R"#,##0'},
    {"name": "Cash Received", "dax": "[Scheme Paid] + [Patient Paid]",
     "format": '"R"#,##0'},
    {"name": "Total Leakage", "dax": "[Billed] - [Cash Received]",
     "format": '"R"#,##0',
     "note": "Billed for care already delivered and never collected."},
    {"name": "Leakage %", "dax": "DIVIDE ( [Total Leakage], [Billed] )",
     "format": "0.0%"},

    # ---- activity
    {"name": "Appointments", "dax": "COUNTROWS ( fct_appointment )", "format": "#,##0"},
    {"name": "Attended",
     "dax": "CALCULATE ( COUNTROWS ( fct_appointment ), fct_appointment[is_attended] = TRUE () )",
     "format": "#,##0"},
    {"name": "No Shows",
     "dax": "CALCULATE ( COUNTROWS ( fct_appointment ), fct_appointment[is_no_show] = TRUE () )",
     "format": "#,##0"},
    {"name": "No Show %", "dax": "DIVIDE ( [No Shows], [Appointments] )", "format": "0.0%"},
    {"name": "Reminded %",
     "dax": "DIVIDE ( CALCULATE ( COUNTROWS ( fct_appointment ), "
            "fct_appointment[reminder_sent] = TRUE () ), [Appointments] )",
     "format": "0.0%"},
    {"name": "Avg Wait Minutes", "dax": "AVERAGE ( fct_appointment[wait_minutes] )",
     "format": "#,##0.0"},
    {"name": "Avg Lead Days", "dax": "AVERAGE ( fct_appointment[booking_lead_days] )",
     "format": "#,##0.0"},

    # ---- claims
    {"name": "Ever Rejected",
     "dax": "CALCULATE ( COUNTROWS ( fct_appointment ), "
            "NOT ISBLANK ( fct_appointment[rejection_reason] ) )",
     "format": "#,##0",
     "note": "Every claim that ever came back, including ones later fixed and paid."},
    {"name": "Recovered Claims",
     "dax": 'CALCULATE ( COUNTROWS ( fct_appointment ), '
            'fct_appointment[claim_status] = "Paid on resubmission" )',
     "format": "#,##0"},
    {"name": "Recovery %", "dax": "DIVIDE ( [Recovered Claims], [Ever Rejected] )",
     "format": "0.0%"},

    # ---- capacity
    {"name": "Slots Offered", "dax": "SUM ( fct_session[slots_offered] )", "format": "#,##0"},
    {"name": "Slots Booked", "dax": "SUM ( fct_session[slots_booked] )", "format": "#,##0"},
    {"name": "Fill %", "dax": "DIVIDE ( [Slots Booked], [Slots Offered] )", "format": "0.0%"},
    {"name": "Empty %",
     "dax": "DIVIDE ( SUM ( fct_session[slots_unfilled] ) + SUM ( fct_session[slots_no_show] ), "
            "[Slots Offered] )",
     "format": "0.0%",
     "note": "Chairs with nobody in them: never booked, plus booked and not arrived."},
    {"name": "Clinician Cost", "dax": "SUM ( fct_session[sessional_cost_zar] )",
     "format": '"R"#,##0'},
    {"name": "Empty Chair Cost",
     "dax": "SUM ( fct_session[unfilled_cost_zar] ) + SUM ( fct_session[no_show_cost_zar] )",
     "format": '"R"#,##0',
     "note": "Cost incurred, not revenue foregone. Never add this to Total Leakage."},
    {"name": "Cost per Attended",
     "dax": "DIVIDE ( [Clinician Cost], SUM ( fct_session[slots_attended] ) )",
     "format": '"R"#,##0.00'},

    # ---- the grid
    {"name": "Grid Fill %",
     "dax": "DIVIDE ( SUM ( fct_capacity_hour[slots_booked] ), "
            "SUM ( fct_capacity_hour[slots_offered] ) )",
     "format": "0.0%"},
    {"name": "Grid Slots Offered", "dax": "SUM ( fct_capacity_hour[slots_offered] )",
     "format": "#,##0"},
]


def lumen_pages():
    return [
        {
            "name": "Where the money went",
            "visuals": [
                textbox(20, 16, 1240, 44,
                        "Lumen billed for care it delivered, and collected on nine rands in ten. "
                        "The rest left through a claims inbox nobody opens and a card machine "
                        "nobody reaches for.", 13),
                card(20, 72, 300, 150, "Billed", "Billed for care delivered"),
                card(332, 72, 300, 150, "Cash Received", "Cash received"),
                card(644, 72, 300, 150, "Total Leakage", "Never collected"),
                card(956, 72, 304, 150, "Leakage %", "Share of everything billed"),
                visual(20, 236, 610, 300, "clusteredBarChart",
                       [("Category", "dim_clinic", "clinic_name", False),
                        ("Y", M, "Total Leakage", True)],
                       "Never collected, by site"),
                visual(644, 236, 616, 300, "clusteredColumnChart",
                       [("Category", "dim_date", "month_label", False),
                        ("Y", M, "Billed", True),
                        ("Y", M, "Cash Received", True)],
                       "Billed against collected, by month"),
                visual(20, 548, 1240, 150, "tableEx",
                       [("Values", "dim_clinic", "clinic_name", False),
                        ("Values", M, "Billed", True),
                        ("Values", M, "Scheme Shortfall", True),
                        ("Values", M, "Patient Shortfall", True),
                        ("Values", M, "Total Leakage", True)],
                       "By site"),
            ],
        },
        {
            "name": "The consulting week",
            "visuals": [
                textbox(20, 16, 1240, 44,
                        "The roster barely changes Monday to Friday. Demand is nothing like it. "
                        "Read the grid across a row: the same hour, five days running.", 13),
                card(20, 72, 300, 130, "Slots Offered", "Consulting slots offered"),
                card(332, 72, 300, 130, "Fill %", "Booked"),
                card(644, 72, 300, 130, "Empty %", "Chairs with nobody in them"),
                card(956, 72, 304, 130, "Empty Chair Cost", "Clinician cost of that"),
                visual(20, 216, 1240, 330, "pivotTable",
                       [("Rows", "dim_date", "day_short", False),
                        ("Columns", "fct_capacity_hour", "slot_hour", False),
                        ("Values", M, "Grid Fill %", True)],
                       "Share of offered slots booked, by weekday and hour"),
                visual(20, 556, 610, 150, "clusteredColumnChart",
                       [("Category", "dim_date", "day_short", False),
                        ("Y", M, "Fill %", True)],
                       "Fill by weekday"),
                visual(644, 556, 616, 150, "clusteredColumnChart",
                       [("Category", "fct_capacity_hour", "slot_hour", False),
                        ("Y", M, "Avg Wait Minutes", True)],
                       "Average wait by hour"),
            ],
        },
        {
            "name": "Claims nobody worked",
            "visuals": [
                textbox(20, 16, 1240, 44,
                        "A scheme allows four months from the date of service. After that the "
                        "money is gone whoever was at fault, which is what makes an unworked "
                        "rejection different from a slow one.", 13),
                card(20, 72, 390, 130, "Ever Rejected", "Claims that came back"),
                card(422, 72, 390, 130, "Recovery %", "Recovered by resubmitting"),
                card(824, 72, 436, 130, "Scheme Shortfall", "Still outstanding"),
                visual(20, 216, 610, 320, "clusteredBarChart",
                       [("Category", "dim_clinic", "clinic_name", False),
                        ("Y", M, "Recovery %", True)],
                       "Share of rejections recovered, by site"),
                visual(644, 216, 616, 320, "clusteredBarChart",
                       [("Category", "fct_appointment", "rejection_class", False),
                        ("Y", M, "Scheme Shortfall", True)],
                       "Outstanding, by what it would take to recover it"),
                visual(20, 548, 1240, 160, "tableEx",
                       [("Values", "fct_appointment", "rejection_reason", False),
                        ("Values", "fct_appointment", "rejection_class", False),
                        ("Values", M, "Ever Rejected", True),
                        ("Values", M, "Recovery %", True),
                        ("Values", M, "Scheme Shortfall", True)],
                       "By reason"),
            ],
        },
        {
            "name": "Patients who never arrived",
            "visuals": [
                textbox(20, 16, 1240, 44,
                        "Read lead time and reminder together, not separately. Either one alone "
                        "looks like a modest effect. Crossed, the best and worst cells are five "
                        "times apart.", 13),
                card(20, 72, 390, 130, "No Shows", "Booked and did not arrive"),
                card(422, 72, 390, 130, "No Show %", "Of everything booked"),
                card(824, 72, 436, 130, "Reminded %", "Bookings that got a reminder"),
                visual(20, 216, 1240, 320, "clusteredColumnChart",
                       [("Category", "fct_appointment", "booking_lead_band", False),
                        ("Series", "fct_appointment", "reminder_sent", False),
                        ("Y", M, "No Show %", True)],
                       "No-show rate by booking lead time and reminder"),
                visual(20, 548, 1240, 160, "tableEx",
                       [("Values", "dim_clinic", "clinic_name", False),
                        ("Values", M, "Appointments", True),
                        ("Values", M, "Reminded %", True),
                        ("Values", M, "No Show %", True),
                        ("Values", M, "Avg Lead Days", True)],
                       "Reminder coverage by site"),
            ],
        },
        {
            "name": "Schemes and capacity",
            "visuals": [
                textbox(20, 16, 1240, 44,
                        "Two numbers that must not be added to the leakage on page one. Empty "
                        "clinician time is cost incurred. A slow scheme is cash arriving late. "
                        "Neither is revenue that never came.", 13),
                visual(20, 72, 1240, 250, "tableEx",
                       [("Values", "dim_scheme", "scheme_name", False),
                        ("Values", M, "Billed", True),
                        ("Values", M, "Scheme Paid", True),
                        ("Values", M, "Scheme Shortfall", True),
                        ("Values", M, "Appointments", True)],
                       "By scheme"),
                visual(20, 336, 610, 330, "clusteredBarChart",
                       [("Category", "dim_practitioner", "discipline", False),
                        ("Y", M, "Cost per Attended", True)],
                       "Sessional cost per patient seen, by discipline"),
                visual(644, 336, 616, 330, "tableEx",
                       [("Values", "dim_practitioner", "practitioner_name", False),
                        ("Values", "dim_practitioner", "discipline", False),
                        ("Values", M, "Fill %", True),
                        ("Values", M, "Cost per Attended", True)],
                       "By practitioner"),
            ],
        },
    ]


SPECS = {
    "04-lumen-health": {
        "model_name": "Lumen Health Network",
        "file_name": "Lumen Health Network",
        "tables": [
            "dim_date", "dim_clinic", "dim_practitioner", "dim_scheme",
            "fct_appointment", "fct_session", "fct_capacity_hour",
        ],
        # (many side, its column, one side, its key). Fact to fact is deliberately absent:
        # the facts already share three dimensions, and a fourth path between them would make
        # the model ambiguous.
        "relationships": [
            ("fct_appointment", "scheduled_date", "dim_date", "date_day"),
            ("fct_session", "session_date", "dim_date", "date_day"),
            ("fct_capacity_hour", "session_date", "dim_date", "date_day"),
            ("fct_appointment", "clinic_code", "dim_clinic", "clinic_code"),
            ("fct_session", "clinic_code", "dim_clinic", "clinic_code"),
            ("fct_capacity_hour", "clinic_code", "dim_clinic", "clinic_code"),
            ("fct_appointment", "practitioner_id", "dim_practitioner", "practitioner_id"),
            ("fct_session", "practitioner_id", "dim_practitioner", "practitioner_id"),
            ("fct_capacity_hour", "practitioner_id", "dim_practitioner", "practitioner_id"),
            ("fct_appointment", "scheme_code", "dim_scheme", "scheme_code"),
        ],
        # Keys and denormalised copies. A user should reach these through the dimension.
        "hide": {
            "fct_appointment": ["clinic_code", "practitioner_id", "scheme_code",
                                "patient_ref", "session_id", "scheduled_date", "claim_id"],
            "fct_session": ["clinic_code", "practitioner_id", "session_id", "session_date"],
            "fct_capacity_hour": ["clinic_code", "practitioner_id", "session_id",
                                  "session_date"],
        },
        # Otherwise Monday sorts after Friday, because F comes before M.
        "sort_by": {
            "dim_date": {"day_short": "day_of_week", "day_name": "day_of_week",
                         "month_label": "month_start"},
        },
        "date_table": ("dim_date", "date_day"),
        "measures": LUMEN_MEASURES,
        "pages": lumen_pages(),
    },
}
