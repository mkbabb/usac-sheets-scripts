=LET(
  frn_data, {ALL_2021_2025_CATEGORY_2!J:J, ALL_2021_2025_CATEGORY_2!A:CD},
  frns, INDEX(frn_data, , 1),

  header, INDEX(frn_data, 1, 0),

  sorted_frn_data, SORT(FILTER(frn_data, NOT(ISBLANK(frns))), 1, TRUE, 5, TRUE, 3, TRUE), 

  pk, {INDEX(sorted_frn_data, , 1), INDEX(sorted_frn_data, , 3)},
  
  unique_data, UNIQUE(pk, FALSE, FALSE),

  unique_frns, INDEX(unique_data, , 1),
  
  unique_frn_data, ARRAYFORMULA(VLOOKUP(unique_frns, sorted_frn_data, SEQUENCE(1, COLUMNS(sorted_frn_data), 1), FALSE)),
  
  bens, INDEX(unique_frn_data, , 7),
  
  filtered_data, FILTER(unique_frn_data, ISNUMBER(MATCH(bens, 'SVF LEAs'!A:A, 0))),
  
  filtered_bens, INDEX(filtered_data, , 7),
  
  district_entity_number, filtered_bens,
  school_type, IFERROR(ARRAYFORMULA(VLOOKUP(filtered_bens, 'SVF LEAs'!A:B, 2, FALSE)), ""),
  lea_number, IFERROR(ARRAYFORMULA(VLOOKUP(filtered_bens, 'SVF LEAs'!A:C, 3, FALSE)), ""),
  lea_name, IFERROR(ARRAYFORMULA(VLOOKUP(filtered_bens, 'SVF LEAs'!A:D, 4, FALSE)), ""),
  
  svf_data, ARRAYFORMULA({district_entity_number, school_type, lea_number, lea_name}),
  
  combined_data, ARRAYFORMULA({svf_data, filtered_data}),
  
  applicant_name, INDEX(filtered_data, , 8),
  applicant_ben, INDEX(filtered_data, , 7),
  applicant_name_ben, ARRAYFORMULA(IF(ISBLANK(applicant_name), "", applicant_name & " (" & applicant_ben & ")")),
  
  final_data, ARRAYFORMULA({combined_data, applicant_name_ben}),
  
  svf_header, {"District Entity Number", "School Type", "LEA Number", "LEA Name"},
  extended_header, {svf_header, header, "Applicant Name (BEN)"},
  
  {extended_header; SORT(final_data, COLUMNS(final_data), TRUE)}
)