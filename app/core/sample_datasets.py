import numpy as np
import pandas as pd


def generate_clinical_trial_dataset(n: int = 120) -> pd.DataFrame:
    """Simulates a randomized controlled laboratory trial with 3 treatment groups."""
    np.random.seed(42)
    patient_ids = [f"PT-{1000 + i}" for i in range(n)]
    groups = np.random.choice(["Placebo", "Drug_A", "Drug_B"], size=n, p=[0.33, 0.33, 0.34])
    ages = np.random.randint(22, 75, size=n)
    genders = np.random.choice(["Male", "Female"], size=n, p=[0.48, 0.52])
    
    baseline_biomarkers = np.round(np.random.normal(68.5, 9.2, size=n), 2)
    
    # Treatment effects
    post_biomarkers = []
    recovery_days = []
    adverse_events = []

    for i in range(n):
        grp = groups[i]
        base = baseline_biomarkers[i]
        age = ages[i]

        if grp == "Placebo":
            reduction = np.random.normal(3.5, 4.0)
            rec = np.random.normal(24.0, 4.5) + (age * 0.05)
            adv = np.random.choice(["No", "Yes"], p=[0.85, 0.15])
        elif grp == "Drug_A":
            reduction = np.random.normal(12.0, 3.8)
            rec = np.random.normal(17.5, 3.2) + (age * 0.04)
            adv = np.random.choice(["No", "Yes"], p=[0.80, 0.20])
        else: # Drug_B
            reduction = np.random.normal(19.5, 4.2)
            rec = np.random.normal(12.8, 2.9) + (age * 0.03)
            adv = np.random.choice(["No", "Yes"], p=[0.75, 0.25])

        post = max(20.0, base - reduction)
        post_biomarkers.append(round(post, 2))
        recovery_days.append(round(max(5.0, rec), 1))
        adverse_events.append(adv)

    df = pd.DataFrame({
        "PatientID": patient_ids,
        "TreatmentGroup": groups,
        "Age": ages,
        "Gender": genders,
        "Baseline_Biomarker": baseline_biomarkers,
        "Post_Biomarker": post_biomarkers,
        "RecoveryDays": recovery_days,
        "AdverseEvent": adverse_events
    })

    # Add a couple realistic missing values for data hygiene simulation
    df.loc[np.random.choice(n, 3, replace=False), "Baseline_Biomarker"] = np.nan
    return df


def generate_student_performance_dataset(n: int = 150) -> pd.DataFrame:
    """Simulates educational research dataset on learning predictors."""
    np.random.seed(101)
    student_ids = [f"STU-{2000 + i}" for i in range(n)]
    study_hours = np.round(np.random.uniform(5.0, 35.0, size=n), 1)
    attendance = np.round(np.random.uniform(60.0, 100.0, size=n), 1)
    tutoring = np.random.choice(["None", "Standard", "Intensive"], size=n, p=[0.5, 0.35, 0.15])
    sleep_hours = np.round(np.random.normal(7.0, 1.1, size=n), 1)

    scores = []
    for i in range(n):
        tut_bonus = 0 if tutoring[i] == "None" else (6.5 if tutoring[i] == "Standard" else 13.0)
        score = 35.0 + (1.2 * study_hours[i]) + (0.35 * attendance[i]) + tut_bonus + np.random.normal(0, 4.5)
        scores.append(round(min(100.0, max(20.0, score)), 1))

    df = pd.DataFrame({
        "StudentID": student_ids,
        "StudyHoursPerWeek": study_hours,
        "AttendancePercentage": attendance,
        "TutoringSupport": tutoring,
        "SleepDurationHours": sleep_hours,
        "FinalExamScore": scores
    })
    return df


def generate_sensor_materials_dataset(n: int = 100) -> pd.DataFrame:
    """Simulates chemical / materials lab experimentation dataset."""
    np.random.seed(7)
    sample_ids = [f"EXP-{3000 + i}" for i in range(n)]
    temp_c = np.round(np.random.uniform(150.0, 350.0, size=n), 1)
    pressure = np.round(np.random.uniform(1.0, 15.0, size=n), 2)
    catalyst = np.random.choice(["Catalyst_Alpha", "Catalyst_Beta", "Catalyst_Gamma"], size=n)

    yields = []
    for i in range(n):
        cat_factor = 1.0 if catalyst[i] == "Catalyst_Alpha" else (1.15 if catalyst[i] == "Catalyst_Beta" else 1.32)
        base_yield = (0.15 * temp_c[i]) + (1.8 * pressure[i])
        y = (base_yield * cat_factor) / 6.0 + np.random.normal(0, 3.2)
        yields.append(round(min(99.5, max(15.0, y)), 2))

    df = pd.DataFrame({
        "SampleID": sample_ids,
        "CatalystType": catalyst,
        "Temperature_C": temp_c,
        "Pressure_bar": pressure,
        "ChemicalYield_Pct": yields
    })
    return df
