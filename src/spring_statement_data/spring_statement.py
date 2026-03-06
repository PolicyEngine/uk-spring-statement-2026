"""Spring Statement Personal Calculator.

Compares how OBR forecast revisions (March 2026 vs November 2025)
affect a sample household's taxes and benefits using PolicyEngine UK.

Since policyengine-uk already has March 2026 values as the default,
the baseline is created by applying November 2025 values as a reform.

Comparison:
  - Baseline = pre-statement (November 2025 OBR forecasts)
  - Reform = no reform (March 2026 OBR forecasts, policyengine-uk default)
  - Impact = March 2026 minus November 2025
"""

from policyengine_uk import Simulation

try:
    from .reforms import (
        PRE_STATEMENT_PARAMS,
        get_pre_statement_scenario,
        get_real_deflator,
        deflate_income_to_2026,
    )
except ImportError:
    from reforms import (
        PRE_STATEMENT_PARAMS,
        get_pre_statement_scenario,
        get_real_deflator,
        deflate_income_to_2026,
    )

CPI_YEARS = range(2025, 2031)

# The source parameter that feeds the uprating pipeline.
CPI_PARAMETER = "gov.economic_assumptions.yoy_growth.obr.consumer_price_index"

# November 2025 CPI values (pre-statement baseline)
PRE_STATEMENT_CPI = {
    int(k[:4]): v for k, v in PRE_STATEMENT_PARAMS[CPI_PARAMETER].items()
}


def _baseline_to_2026(year):
    """Deflator to convert baseline year-Y nominal £ to 2026 £."""
    cum = 1.0
    for y in range(2027, year + 1):
        cum *= 1 + PRE_STATEMENT_CPI.get(y, 0)
    return 1.0 / cum


def _compute_decomposition(
    baseline_net,
    reform_net,
    total_taxes_b,
    total_taxes_r,
    total_benefits_b,
    total_benefits_r,
    market_income_b,
    market_income_r,
    year,
    pension_contrib_b=0,
    pension_contrib_r=0,
):
    """Decompose the real net income impact into four components.

    Steps:
    1. Compute nominal changes: market income, taxes, benefits,
       pension contributions
    2. Sum to nominal net income change
    3. Apply purchasing power adjustment to reform net income
       (CPI deflator converts reform £ to baseline price level)
    4. Total real change = nominal change + purchasing power

    Components:
    1. market_income — change in household_market_income
    2. taxes — nominal change in household_tax (positive = taxes fell = good)
    3. benefits — nominal change in household_benefits
    4. purchasing_power — CPI adjustment applied to reform net income

    Net income = market_income + benefits - taxes - pension_contributions.
    The four displayed components plus pension_contributions sum exactly
    to *total*.
    """
    deflator = get_real_deflator(year)

    # Nominal changes (round individually)
    market_income_effect = round(market_income_r - market_income_b, 2)
    taxes_effect = round(-(total_taxes_r - total_taxes_b), 2)
    benefits_effect = round(total_benefits_r - total_benefits_b, 2)
    pension_contrib_effect = round(-(pension_contrib_r - pension_contrib_b), 2)

    # Purchasing power: CPI adjustment applied to reform net income
    purchasing_power_raw = reform_net * (deflator - 1)

    # Total = nominal change + purchasing power (from unrounded values)
    nominal_raw = (
        (market_income_r - market_income_b)
        + (-(total_taxes_r - total_taxes_b))
        + (total_benefits_r - total_benefits_b)
        + (-(pension_contrib_r - pension_contrib_b))
    )
    total = round(nominal_raw + purchasing_power_raw, 2)

    # Purchasing power absorbs rounding so components sum exactly to total
    purchasing_power = total - market_income_effect - taxes_effect - benefits_effect - pension_contrib_effect

    return {
        "market_income": market_income_effect,
        "taxes": taxes_effect,
        "benefits": benefits_effect,
        "pension_contributions": pension_contrib_effect,
        "purchasing_power": round(purchasing_power, 2),
        "total": total,
        "details": {
            "market_income": {"baseline": round(market_income_b, 2), "reform": round(market_income_r, 2)},
            "taxes": {"baseline": round(total_taxes_b, 2), "reform": round(total_taxes_r, 2)},
            "benefits": {"baseline": round(total_benefits_b, 2), "reform": round(total_benefits_r, 2)},
            "pension_contributions": {"baseline": round(pension_contrib_b, 2), "reform": round(pension_contrib_r, 2)},
            "net_income": {"baseline": round(baseline_net, 2), "reform": round(reform_net, 2)},
            "real_net_income": {
                "baseline": round(baseline_net * _baseline_to_2026(year), 2),
                "reform": round(baseline_net * _baseline_to_2026(year) + total, 2),
            },
        },
    }


# ---------------------------------------------------------------------------
# Variable extraction config: (variable_name, entity_level)
# entity_level: "person" = sum across people, "benunit" = first benunit,
#               "household" = first household
# ---------------------------------------------------------------------------
PERSON_VARS = "person"
BENUNIT_VARS = "benunit"
HOUSEHOLD_VARS = "household"

# Ordered group definitions for display.
PROGRAM_GROUPS = [
    {"id": "direct_taxes", "label": "Direct Taxes"},
    {"id": "property_local_taxes", "label": "Property & Local Taxes"},
    {"id": "other_deductions", "label": "Other Deductions"},
    {"id": "core_benefits", "label": "Core Benefits"},
    {"id": "pension_retirement", "label": "Pension & Retirement"},
    {"id": "disability_carer", "label": "Disability & Carer Benefits"},
    {"id": "employment_support", "label": "Employment Support"},
    {"id": "childcare", "label": "Childcare"},
    {"id": "scottish_benefits", "label": "Scottish Benefits"},
]

# Top-level programs with their sub-components for breakdown display.
# Structure: list of dicts, each with id, label, entity, is_tax, group, children.
PROGRAM_STRUCTURE = [
    # -- DIRECT TAXES --
    {
        "id": "income_tax",
        "label": "Income Tax",
        "entity": PERSON_VARS,
        "is_tax": True,
        "group": "direct_taxes",
        "children": [
            {
                "id": "earned_income_tax",
                "label": "Earned Income",
                "entity": PERSON_VARS,
            },
            {
                "id": "savings_income_tax",
                "label": "Savings Income",
                "entity": PERSON_VARS,
            },
            {
                "id": "dividend_income_tax",
                "label": "Dividend Income",
                "entity": PERSON_VARS,
            },
        ],
    },
    {
        "id": "national_insurance",
        "label": "National Insurance",
        "entity": PERSON_VARS,
        "is_tax": True,
        "group": "direct_taxes",
        "children": [
            {
                "id": "ni_class_1_employee",
                "label": "Class 1 (Employee)",
                "entity": PERSON_VARS,
            },
            {
                "id": "ni_class_2",
                "label": "Class 2 (Self-Employed)",
                "entity": PERSON_VARS,
            },
            {
                "id": "ni_class_4",
                "label": "Class 4 (Self-Employed)",
                "entity": PERSON_VARS,
            },
        ],
    },
    {
        "id": "capital_gains_tax",
        "label": "Capital Gains Tax",
        "entity": PERSON_VARS,
        "is_tax": True,
        "group": "direct_taxes",
    },
    # -- PROPERTY & LOCAL TAXES --
    {
        "id": "domestic_rates",
        "label": "Domestic Rates (NI)",
        "entity": HOUSEHOLD_VARS,
        "is_tax": True,
        "group": "property_local_taxes",
    },
    {
        "id": "stamp_duty_land_tax",
        "label": "Stamp Duty Land Tax",
        "entity": HOUSEHOLD_VARS,
        "is_tax": True,
        "group": "property_local_taxes",
    },
    {
        "id": "lbtt",
        "label": "Land & Buildings Transaction Tax",
        "entity": HOUSEHOLD_VARS,
        "is_tax": True,
        "group": "property_local_taxes",
    },
    {
        "id": "land_transaction_tax",
        "label": "Land Transaction Tax",
        "entity": HOUSEHOLD_VARS,
        "is_tax": True,
        "group": "property_local_taxes",
    },
    {
        "id": "business_rates",
        "label": "Business Rates",
        "entity": HOUSEHOLD_VARS,
        "is_tax": True,
        "group": "property_local_taxes",
    },
    # -- OTHER DEDUCTIONS --
    {
        "id": "student_loan_repayment",
        "label": "Student Loan Repayment",
        "entity": PERSON_VARS,
        "is_tax": True,
        "group": "other_deductions",
    },
    {
        "id": "tv_licence",
        "label": "TV Licence",
        "entity": HOUSEHOLD_VARS,
        "is_tax": True,
        "group": "other_deductions",
    },
    # -- CORE BENEFITS --
    {
        "id": "universal_credit",
        "label": "Universal Credit",
        "entity": BENUNIT_VARS,
        "is_tax": False,
        "group": "core_benefits",
        "children": [
            {
                "id": "uc_standard_allowance",
                "label": "Standard Allowance",
                "entity": BENUNIT_VARS,
            },
            {
                "id": "uc_child_element",
                "label": "Child Element",
                "entity": BENUNIT_VARS,
            },
            {
                "id": "uc_housing_costs_element",
                "label": "Housing Element",
                "entity": BENUNIT_VARS,
            },
            {
                "id": "uc_childcare_element",
                "label": "Childcare Element",
                "entity": BENUNIT_VARS,
            },
            {
                "id": "uc_disability_element",
                "label": "Disability Element",
                "entity": BENUNIT_VARS,
            },
            {
                "id": "uc_carer_element",
                "label": "Carer Element",
                "entity": BENUNIT_VARS,
            },
        ],
    },
    {
        "id": "child_benefit",
        "label": "Child Benefit",
        "entity": BENUNIT_VARS,
        "is_tax": False,
        "group": "core_benefits",
        "children": [
            {
                "id": "child_benefit_less_tax_charge",
                "label": "After High-Income Tax Charge",
                "entity": BENUNIT_VARS,
            },
        ],
    },
    # -- PENSION & RETIREMENT --
    {
        "id": "state_pension",
        "label": "State Pension",
        "entity": PERSON_VARS,
        "is_tax": False,
        "group": "pension_retirement",
    },
    {
        "id": "pension_credit",
        "label": "Pension Credit",
        "entity": BENUNIT_VARS,
        "is_tax": False,
        "group": "pension_retirement",
        "children": [
            {
                "id": "guarantee_credit",
                "label": "Guarantee Credit",
                "entity": BENUNIT_VARS,
            },
            {
                "id": "savings_credit",
                "label": "Savings Credit",
                "entity": BENUNIT_VARS,
            },
        ],
    },
    {
        "id": "winter_fuel_allowance",
        "label": "Winter Fuel Allowance",
        "entity": HOUSEHOLD_VARS,
        "is_tax": False,
        "group": "pension_retirement",
    },
    # -- DISABILITY & CARER BENEFITS --
    {
        "id": "pip",
        "label": "Personal Independence Payment",
        "entity": PERSON_VARS,
        "is_tax": False,
        "group": "disability_carer",
        "children": [
            {"id": "pip_dl", "label": "Daily Living", "entity": PERSON_VARS},
            {"id": "pip_m", "label": "Mobility", "entity": PERSON_VARS},
        ],
    },
    {
        "id": "dla",
        "label": "Disability Living Allowance",
        "entity": PERSON_VARS,
        "is_tax": False,
        "group": "disability_carer",
        "children": [
            {"id": "dla_sc", "label": "Self-Care", "entity": PERSON_VARS},
            {"id": "dla_m", "label": "Mobility", "entity": PERSON_VARS},
        ],
    },
    {
        "id": "attendance_allowance",
        "label": "Attendance Allowance",
        "entity": PERSON_VARS,
        "is_tax": False,
        "group": "disability_carer",
    },
    {
        "id": "carers_allowance",
        "label": "Carer's Allowance",
        "entity": PERSON_VARS,
        "is_tax": False,
        "group": "disability_carer",
    },
    # -- EMPLOYMENT SUPPORT --
    {
        "id": "esa_income",
        "label": "ESA (Income-Related)",
        "entity": BENUNIT_VARS,
        "is_tax": False,
        "group": "employment_support",
    },
    {
        "id": "esa_contrib",
        "label": "ESA (Contributory)",
        "entity": PERSON_VARS,
        "is_tax": False,
        "group": "employment_support",
    },
    {
        "id": "jsa_income",
        "label": "JSA (Income-Based)",
        "entity": BENUNIT_VARS,
        "is_tax": False,
        "group": "employment_support",
    },
    {
        "id": "jsa_contrib",
        "label": "JSA (Contributory)",
        "entity": PERSON_VARS,
        "is_tax": False,
        "group": "employment_support",
    },
    {
        "id": "income_support",
        "label": "Income Support",
        "entity": BENUNIT_VARS,
        "is_tax": False,
        "group": "employment_support",
    },
    {
        "id": "statutory_sick_pay",
        "label": "Statutory Sick Pay",
        "entity": PERSON_VARS,
        "is_tax": False,
        "group": "employment_support",
    },
    {
        "id": "statutory_maternity_pay",
        "label": "Statutory Maternity Pay",
        "entity": PERSON_VARS,
        "is_tax": False,
        "group": "employment_support",
    },
    # -- CHILDCARE --
    {
        "id": "tax_free_childcare",
        "label": "Tax-Free Childcare",
        "entity": BENUNIT_VARS,
        "is_tax": False,
        "group": "childcare",
    },
    {
        "id": "universal_childcare_entitlement",
        "label": "Universal Childcare Entitlement",
        "entity": PERSON_VARS,
        "is_tax": False,
        "group": "childcare",
    },
    {
        "id": "extended_childcare_entitlement",
        "label": "Extended Childcare Entitlement",
        "entity": BENUNIT_VARS,
        "is_tax": False,
        "group": "childcare",
    },
    {
        "id": "targeted_childcare_entitlement",
        "label": "Targeted Childcare Entitlement",
        "entity": PERSON_VARS,
        "is_tax": False,
        "group": "childcare",
    },
    # -- SCOTTISH BENEFITS --
    {
        "id": "scottish_child_payment",
        "label": "Scottish Child Payment",
        "entity": PERSON_VARS,
        "is_tax": False,
        "group": "scottish_benefits",
        "region": "SCOTLAND",
    },
]


def _all_variable_ids():
    """Get flat list of all variable IDs including children."""
    ids = []
    for prog in PROGRAM_STRUCTURE:
        ids.append(prog["id"])
        for child in prog.get("children", []):
            ids.append(child["id"])
    return ids


ALL_VARIABLE_IDS = _all_variable_ids()


def _get_march_2026_cpi(sim: Simulation) -> dict:
    """Read March 2026 CPI YoY growth values from PE UK's parameter tree.

    These are the default policyengine-uk values (the reform / post-statement).
    """
    param = (
        sim.tax_benefit_system.parameters.gov.economic_assumptions.yoy_growth.obr.consumer_price_index
    )
    return {year: float(param(f"{year}-01-01")) for year in CPI_YEARS}


def _build_situation(
    employment_income: float,
    num_children: int,
    monthly_rent: float,
    is_couple: bool,
    partner_income: float,
    year: int,
    adult_age: int = 30,
    partner_age: int = 30,
    children_ages: list = None,
    region: str = "LONDON",
    council_tax_band: str = "D",
    tenure_type: str = "RENT_PRIVATELY",
    childcare_expenses: float = 0,
    pension_contributions: float = 0,
    student_loan_plan: str = "NO_STUDENT_LOAN",
    self_employment_income: float = 0,
    income_base_year: int = None,
) -> dict:
    """Build a PolicyEngine household situation dict.

    If *income_base_year* is set (e.g. 2026), employment/self-employment
    income is pinned at that year and PolicyEngine uprates it to *year*
    using the earnings growth forecast.  This means baseline vs reform
    will produce different market incomes for years after the base year.
    """
    inc_year = income_base_year or year
    people = {
        "adult": {
            "age": {year: adult_age},
            "employment_income": {inc_year: employment_income},
        }
    }

    if self_employment_income > 0:
        people["adult"]["self_employment_income"] = {
            inc_year: self_employment_income
        }
    if pension_contributions > 0:
        people["adult"]["personal_pension_contributions"] = {
            inc_year: pension_contributions * 12
        }
    members = ["adult"]

    if student_loan_plan != "NO_STUDENT_LOAN":
        people["adult"]["student_loan_plan"] = {year: student_loan_plan}

    if is_couple:
        people["partner"] = {
            "age": {year: partner_age},
            "employment_income": {inc_year: partner_income},
        }
        members.append("partner")

    # Use provided children_ages or default to evenly spaced ages
    if children_ages is None:
        children_ages = [5 + i * 2 for i in range(num_children)]
    for i in range(num_children):
        child_id = f"child_{i + 1}"
        age = children_ages[i] if i < len(children_ages) else 5 + i * 2
        people[child_id] = {
            "age": {year: age},
        }
        members.append(child_id)

    situation = {
        "people": people,
        "benunits": {
            "benunit": {
                "members": members,
            }
        },
        "households": {
            "household": {
                "members": members,
                "region": {year: region},
                "council_tax_band": {year: council_tax_band},
                "tenure_type": {year: tenure_type},
            }
        },
    }

    if monthly_rent > 0:
        situation["households"]["household"]["rent"] = {
            year: monthly_rent * 12
        }

    if num_children > 0 or monthly_rent > 0:
        situation["benunits"]["benunit"]["would_claim_uc"] = {year: True}

    if childcare_expenses > 0:
        # Assign childcare expenses to the first child
        first_child = next(
            (m for m in members if m.startswith("child_")), None
        )
        if first_child:
            people[first_child]["childcare_expenses"] = {
                year: childcare_expenses * 12
            }

    return situation


def _extract_results(sim: Simulation, situation: dict, year: int) -> dict:
    """Extract all tax/benefit values from a completed simulation."""
    num_people = len(situation["people"])
    results = {}

    def _person_sum(variable: str) -> float:
        raw = sim.calculate(variable, year)
        return float(raw.sum()) if num_people > 1 else float(raw[0])

    def _benunit_val(variable: str) -> float:
        return float(sim.calculate(variable, year)[0])

    def _household_val(variable: str) -> float:
        return float(sim.calculate(variable, year)[0])

    # Build entity lookup from PROGRAM_STRUCTURE
    entity_map = {}
    for prog in PROGRAM_STRUCTURE:
        entity_map[prog["id"]] = prog["entity"]
        for child in prog.get("children", []):
            entity_map[child["id"]] = child["entity"]

    for var_id in ALL_VARIABLE_IDS:
        entity = entity_map[var_id]
        try:
            if entity == PERSON_VARS:
                results[var_id] = round(_person_sum(var_id), 2)
            elif entity == BENUNIT_VARS:
                results[var_id] = round(_benunit_val(var_id), 2)
            else:
                results[var_id] = round(_household_val(var_id), 2)
        except Exception:
            results[var_id] = 0.0

    results["household_net_income"] = round(
        _household_val("household_net_income"), 2
    )
    results["real_household_net_income"] = round(
        _household_val("real_household_net_income"), 2
    )

    # PE aggregate variables for consistent decomposition
    results["household_market_income"] = round(
        _household_val("household_market_income"), 2
    )
    results["household_tax"] = round(
        _household_val("household_tax"), 2
    )
    results["household_benefits"] = round(
        _household_val("household_benefits"), 2
    )
    results["pension_contributions"] = round(_person_sum("pension_contributions"), 2)

    # Legacy: market income = employment + self-employment
    try:
        market = _person_sum("employment_income") + _person_sum(
            "self_employment_income"
        )
    except Exception:
        market = _person_sum("employment_income")
    results["market_income"] = round(market, 2)

    return results


def calculate_household_impact(
    employment_income: float,
    num_children: int,
    monthly_rent: float,
    is_couple: bool,
    partner_income: float,
    year: int = 2026,
    adult_age: int = 30,
    partner_age: int = 30,
    children_ages: list = None,
    region: str = "LONDON",
    council_tax_band: str = "D",
    tenure_type: str = "RENT_PRIVATELY",
    childcare_expenses: float = 0,
    pension_contributions: float = 0,
    student_loan_plan: str = "NO_STUDENT_LOAN",
    self_employment_income: float = 0,
) -> dict:
    """Calculate the impact of OBR forecast revisions on a household.

    Runs two PolicyEngine simulations:
    - Baseline: November 2025 OBR forecasts (pre-statement)
    - Reform: March 2026 OBR forecasts (post-statement, PE UK default)

    Income is set at 2025 (fiscal year 2025-26) and PolicyEngine
    uprates it to the target year using each scenario's earnings growth.
    """
    situation = _build_situation(
        employment_income=employment_income,
        num_children=num_children,
        monthly_rent=monthly_rent,
        is_couple=is_couple,
        partner_income=partner_income,
        year=year,
        adult_age=adult_age,
        partner_age=partner_age,
        children_ages=children_ages,
        region=region,
        council_tax_band=council_tax_band,
        tenure_type=tenure_type,
        childcare_expenses=childcare_expenses,
        pension_contributions=pension_contributions,
        student_loan_plan=student_loan_plan,
        self_employment_income=self_employment_income,
        income_base_year=2025,
    )

    # Baseline = November 2025 forecasts (pre-statement)
    pre_statement_scenario = get_pre_statement_scenario()
    baseline_sim = Simulation(
        situation=situation, scenario=pre_statement_scenario
    )
    baseline = _extract_results(baseline_sim, situation, year)

    # Reform = March 2026 forecasts (policyengine-uk default)
    reform_sim = Simulation(situation=situation)
    reform = _extract_results(reform_sim, situation, year)

    # Read March 2026 CPI values from reform sim's parameter tree
    march_2026_cpi = _get_march_2026_cpi(reform_sim)

    # Compute impact for all variables
    impact = {}
    for var_id in ALL_VARIABLE_IDS:
        impact[var_id] = round(reform[var_id] - baseline[var_id], 2)
    impact["household_net_income"] = round(
        reform["household_net_income"] - baseline["household_net_income"], 2
    )

    # Build full program structure, filtering by region where applicable.
    active_structure = []
    total_taxes_b = 0.0
    total_taxes_r = 0.0
    total_benefits_b = 0.0
    total_benefits_r = 0.0
    for prog in PROGRAM_STRUCTURE:
        prog_region = prog.get("region")
        if prog_region and prog_region != region:
            continue
        pid = prog["id"]
        if prog.get("is_tax", False):
            total_taxes_b += baseline.get(pid, 0)
            total_taxes_r += reform.get(pid, 0)
        else:
            total_benefits_b += baseline.get(pid, 0)
            total_benefits_r += reform.get(pid, 0)
        entry = {
            "id": pid,
            "label": prog["label"],
            "is_tax": prog.get("is_tax", False),
            "group": prog["group"],
        }
        children = prog.get("children", [])
        if children:
            entry["children"] = [
                {"id": child["id"], "label": child["label"]}
                for child in children
            ]
        active_structure.append(entry)

    decomposition = _compute_decomposition(
        baseline["household_net_income"],
        reform["household_net_income"],
        baseline["household_tax"],
        reform["household_tax"],
        baseline["household_benefits"],
        reform["household_benefits"],
        baseline["household_market_income"],
        reform["household_market_income"],
        year,
        pension_contrib_b=baseline["pension_contributions"],
        pension_contrib_r=reform["pension_contributions"],
    )

    return {
        "baseline": baseline,
        "reform": reform,
        "impact": impact,
        "decomposition": decomposition,
        "program_structure": active_structure,
        "program_groups": PROGRAM_GROUPS,
        "cpi_values": {
            "november_2025": PRE_STATEMENT_CPI,
            "march_2026": march_2026_cpi,
        },
    }


def calculate_multi_year_net_impact(
    employment_income: float,
    num_children: int,
    monthly_rent: float,
    is_couple: bool,
    partner_income: float,
    adult_age: int = 30,
    partner_age: int = 30,
    children_ages: list = None,
    region: str = "LONDON",
    council_tax_band: str = "D",
    tenure_type: str = "RENT_PRIVATELY",
    childcare_expenses: float = 0,
    pension_contributions: float = 0,
    student_loan_plan: str = "NO_STUDENT_LOAN",
    self_employment_income: float = 0,
    income_year: int = 2026,
) -> dict:
    """Calculate net household income impact for each year 2026-2030.

    Baseline = November 2025 OBR forecasts (pre-statement).
    Reform = March 2026 OBR forecasts (PE UK default).
    Income is set at 2025 (fiscal year 2025-26) and PolicyEngine
    uprates it to each target year using each scenario's earnings growth.
    """

    yearly_impact = {}
    yearly_breakdown = {}

    # Top-level programs only (no children) for lightweight extraction
    top_programs = [
        {
            "id": p["id"],
            "label": p["label"],
            "entity": p["entity"],
            "is_tax": p.get("is_tax", False),
        }
        for p in PROGRAM_STRUCTURE
        if not (p.get("region") and p["region"] != region)
    ]

    def _calculate_year(year):
        situation = _build_situation(
            employment_income=employment_income,
            num_children=num_children,
            monthly_rent=monthly_rent,
            is_couple=is_couple,
            partner_income=partner_income,
            year=year,
            adult_age=adult_age,
            partner_age=partner_age,
            children_ages=children_ages,
            region=region,
            council_tax_band=council_tax_band,
            tenure_type=tenure_type,
            childcare_expenses=childcare_expenses,
            pension_contributions=pension_contributions,
            student_loan_plan=student_loan_plan,
            self_employment_income=self_employment_income,
            income_base_year=2025,
        )

        num_people = len(situation["people"])

        def _calc(sim, var_id, entity):
            try:
                if entity == PERSON_VARS:
                    raw = sim.calculate(var_id, year)
                    return (
                        float(raw.sum()) if num_people > 1 else float(raw[0])
                    )
                else:
                    return float(sim.calculate(var_id, year)[0])
            except Exception:
                return 0.0

        # Fresh scenario each iteration to avoid state contamination
        scenario = get_pre_statement_scenario()

        # Baseline = November 2025 (pre-statement)
        baseline_sim = Simulation(
            situation=situation,
            scenario=scenario,
        )
        baseline_net = float(
            baseline_sim.calculate("household_net_income", year)[0]
        )

        # Reform = March 2026 (PE UK default)
        reform_sim = Simulation(situation=situation)
        reform_net = float(
            reform_sim.calculate("household_net_income", year)[0]
        )

        impact = round(reform_net - baseline_net, 2)

        # PE aggregate variables for consistent decomposition
        def _hh_val(sim, var):
            return float(sim.calculate(var, year)[0])

        def _person_sum(sim, var):
            raw = sim.calculate(var, year)
            return float(raw.sum()) if num_people > 1 else float(raw[0])

        market_b = _hh_val(baseline_sim, "household_market_income")
        market_r = _hh_val(reform_sim, "household_market_income")
        total_taxes_b = _hh_val(baseline_sim, "household_tax")
        total_taxes_r = _hh_val(reform_sim, "household_tax")
        total_benefits_b = _hh_val(baseline_sim, "household_benefits")
        total_benefits_r = _hh_val(reform_sim, "household_benefits")
        pc_b = _person_sum(baseline_sim, "pension_contributions")
        pc_r = _person_sum(reform_sim, "pension_contributions")

        breakdown = []
        for prog in top_programs:
            b_val = _calc(baseline_sim, prog["id"], prog["entity"])
            r_val = _calc(reform_sim, prog["id"], prog["entity"])
            diff = r_val - b_val
            if abs(diff) > 0.005:
                household_impact = -diff if prog["is_tax"] else diff
                breakdown.append(
                    {
                        "label": prog["label"],
                        "impact": round(household_impact, 2),
                    }
                )

        decomposition = _compute_decomposition(
            baseline_net,
            reform_net,
            total_taxes_b,
            total_taxes_r,
            total_benefits_b,
            total_benefits_r,
            market_b,
            market_r,
            year,
            pension_contrib_b=pc_b,
            pension_contrib_r=pc_r,
        )

        return str(year), impact, breakdown, decomposition

    # Run sequentially with fresh scenario each iteration
    yearly_decomposition = {}
    for yr in range(2026, 2031):
        year_str, impact, breakdown, decomposition = _calculate_year(yr)
        yearly_impact[year_str] = impact
        yearly_breakdown[year_str] = breakdown
        yearly_decomposition[year_str] = decomposition

    return {
        "yearly_impact": yearly_impact,
        "yearly_breakdown": yearly_breakdown,
        "yearly_decomposition": yearly_decomposition,
    }


# ---------------------------------------------------------------------------
# Marginal Tax Rate data across income range
# ---------------------------------------------------------------------------

# Variables to extract for MTR component breakdown
_MTR_TAX_VARS = [
    ("income_tax", PERSON_VARS),
    ("national_insurance", PERSON_VARS),
]

_MTR_BENEFIT_VARS = [
    ("universal_credit", BENUNIT_VARS),
    ("child_benefit", BENUNIT_VARS),
    ("pension_credit", BENUNIT_VARS),
]


def calculate_mtr_data(
    num_children: int,
    monthly_rent: float,
    is_couple: bool,
    partner_income: float,
    year: int = 2026,
    adult_age: int = 30,
    partner_age: int = 30,
    children_ages: list = None,
    region: str = "LONDON",
    council_tax_band: str = "D",
    tenure_type: str = "RENT_PRIVATELY",
    childcare_expenses: float = 0,
    student_loan_plan: str = "NO_STUDENT_LOAN",
    self_employment_income: float = 0,
) -> dict:
    """Calculate marginal tax rates across an income range.

    Baseline = November 2025 forecasts, Reform = March 2026 (default).
    Uses PolicyEngine's axes feature for vectorised evaluation.
    """
    import numpy as np

    num_points = 50
    pre_statement_scenario = get_pre_statement_scenario()

    # Build the situation with axes (varies employment_income for the adult)
    people = {
        "adult": {
            "age": {year: adult_age},
            "employment_income": {year: 0},  # placeholder; axes overrides
        }
    }
    members = ["adult"]

    if self_employment_income > 0:
        people["adult"]["self_employment_income"] = {
            year: self_employment_income
        }

    if student_loan_plan != "NO_STUDENT_LOAN":
        people["adult"]["student_loan_plan"] = {year: student_loan_plan}

    if is_couple:
        people["partner"] = {
            "age": {year: partner_age},
            "employment_income": {year: partner_income},
        }
        members.append("partner")

    if children_ages is None:
        children_ages_list = [5 + i * 2 for i in range(num_children)]
    else:
        children_ages_list = list(children_ages)
    for i in range(num_children):
        cid = f"child_{i + 1}"
        age = (
            children_ages_list[i] if i < len(children_ages_list) else 5 + i * 2
        )
        people[cid] = {"age": {year: age}}
        members.append(cid)

    situation = {
        "people": people,
        "benunits": {"benunit": {"members": members}},
        "households": {
            "household": {
                "members": members,
                "region": {year: region},
                "council_tax_band": {year: council_tax_band},
                "tenure_type": {year: tenure_type},
            }
        },
        "axes": [
            [
                {
                    "name": "employment_income",
                    "min": 0,
                    "max": 150_000,
                    "count": num_points,
                    "period": str(year),
                }
            ]
        ],
    }

    if monthly_rent > 0:
        situation["households"]["household"]["rent"] = {
            year: monthly_rent * 12
        }
    if num_children > 0 or monthly_rent > 0:
        situation["benunits"]["benunit"]["would_claim_uc"] = {year: True}
    if childcare_expenses > 0:
        first_child = next(
            (m for m in members if m.startswith("child_")), None
        )
        if first_child:
            people[first_child]["childcare_expenses"] = {
                year: childcare_expenses * 12
            }

    num_people = len(people)

    def _run_scenario(use_reform: bool) -> list[dict]:
        if use_reform:
            # Reform = March 2026 (PE UK default, no scenario)
            sim = Simulation(situation=situation)
        else:
            # Baseline = November 2025 (pre-statement)
            sim = Simulation(
                situation=situation,
                scenario=pre_statement_scenario,
            )

        # Person-level vars: reshape to (num_points, num_people) and sum
        income_tax = (
            sim.calculate("income_tax", year)
            .reshape(-1, num_people)
            .sum(axis=1)
        )
        ni = (
            sim.calculate("national_insurance", year)
            .reshape(-1, num_people)
            .sum(axis=1)
        )
        employment_income = sim.calculate("employment_income", year).reshape(
            -1, num_people
        )[:, 0]

        # Benunit / household level vars: one value per point
        uc = sim.calculate("universal_credit", year)
        cb = sim.calculate("child_benefit", year)
        pc = sim.calculate("pension_credit", year)
        benefits = uc + cb + pc

        net_income = sim.calculate("household_net_income", year)

        # Compute marginal rates via np.gradient
        delta = (
            float(employment_income[1] - employment_income[0])
            if len(employment_income) > 1
            else 1000
        )
        it_marginal = np.gradient(income_tax, delta)
        ni_marginal = np.gradient(ni, delta)
        ben_marginal = -np.gradient(benefits, delta)
        total_marginal = 1 - np.gradient(net_income, delta)

        mtr_data = []
        for j in range(len(employment_income)):
            mtr_data.append(
                {
                    "income": round(float(employment_income[j])),
                    "income_tax": round(float(it_marginal[j]), 4),
                    "national_insurance": round(float(ni_marginal[j]), 4),
                    "benefits_taper": round(float(ben_marginal[j]), 4),
                    "total": round(float(total_marginal[j]), 4),
                }
            )

        return mtr_data

    baseline = _run_scenario(False)
    reform = _run_scenario(True)

    return {"baseline": baseline, "reform": reform}
