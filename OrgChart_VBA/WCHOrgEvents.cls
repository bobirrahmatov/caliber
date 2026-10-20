VERSION 1.0 CLASS
BEGIN
  MultiUse = -1
END
Attribute VB_Name = "WCHOrgEvents"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = False
Attribute VB_PredeclaredId = False
Attribute VB_Exposed = False
Option Explicit

Public WithEvents Host As Excel.Application

Private Sub Host_SheetChange(ByVal Sh As Object, ByVal Target As Excel.Range)
    WCHOrgChanged Sh, Target
End Sub

Private Sub Host_AfterCalculate()
    WCHOrgAfterCalculate
End Sub

Private Sub Host_WorkbookActivate(ByVal Wb As Excel.Workbook)
    If Wb Is ThisWorkbook Then WCHOrgAfterCalculate
End Sub
