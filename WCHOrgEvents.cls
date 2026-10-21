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

' No AfterCalculate, SheetCalculate or WorkbookActivate hook.
' Filters only mark the existing diagram stale; drawing is button-only.
