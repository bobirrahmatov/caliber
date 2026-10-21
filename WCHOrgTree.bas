Attribute VB_Name = "WCHOrgTree"
Option Explicit

' Org-chart-only extension for the v14 native dashboard.
' No chart series, KPI formulas, source cells or Calculations formulas are written.
Private Const PREFIX As String = "WCHOrg15_"
Private Const FONT_NAME As String = "Citi Sans Display"
Private Const CARD_WIDTH As Double = 252
Private Const X_GAP As Double = 28
Private Const Y_GAP As Double = 44
Private Const STACK_GAP As Double = 16
Private Const MAX_NODES As Long = 1100

Private Type OrgPerson
    Key As String
    ParentKey As String
    PersonName As String
    JobTitle As String
    Ratings As String
    Caption As String
    SourceRow As Long
    ParentIndex As Long
    InScope As Boolean
    Included As Boolean
    Unresolved As Boolean
    IsVirtual As Boolean
    ChildCount As Long
    StackLeaves As Boolean
    CardHeight As Double
    TreeWidth As Double
    TreeHeight As Double
    PosX As Double
    PosY As Double
    VisitState As Long
End Type

Private people() As OrgPerson
Private personCount As Long
Private rootIndex As Long
Private nextShape As Long
Private canvasReady As Boolean
Private orgStale As Boolean
Private managerKeys As Variant
Private managerLabels As Variant
Public WCHOrgBusy As Boolean
Public WCHOrgListener As WCHOrgEvents

Public Sub Auto_Open()
    WCHOrgConnect
End Sub

Public Sub Auto_Close()
    Set WCHOrgListener = Nothing
End Sub

Public Sub WCHOrgStart()
    Dim d As Worksheet
    Dim oldEvents As Boolean, oldScreen As Boolean
    oldEvents = Application.EnableEvents
    oldScreen = Application.ScreenUpdating
    On Error GoTo Failed
    WCHOrgBusy = True
    Application.EnableEvents = False
    Application.ScreenUpdating = False
    Set d = ThisWorkbook.Worksheets("Dashboard")
    PrepareCanvas d
    Application.EnableEvents = oldEvents
    Application.ScreenUpdating = oldScreen
    WCHOrgBusy = False
    WCHOrgConnect
    Exit Sub
Failed:
    Application.EnableEvents = oldEvents
    Application.ScreenUpdating = oldScreen
    WCHOrgBusy = False
    MsgBox "Org chart setup could not finish: " & Err.Description, vbExclamation
End Sub

Private Sub WCHOrgConnect()
    Set WCHOrgListener = New WCHOrgEvents
    Set WCHOrgListener.Host = Application
    orgStale = False
    WCHOrgMarkStale
End Sub

Public Sub WCHOrgRefresh()
    WCHOrgUpdate
End Sub

Public Sub WCHOrgAfterCalculate()
    ' Compatibility with the previous event class: deliberately no work.
    ' No data scans or drawing from calculation/activation events.
End Sub

Public Sub WCHOrgChanged(ByVal Sh As Object, ByVal Target As Range)
    If WCHOrgBusy Then Exit Sub
    If Not (Sh.Parent Is ThisWorkbook) Then Exit Sub
    If Sh.Name = "Dashboard" Then
        If Not Application.Intersect(Target, Sh.Range("B7,N7,AF7")) Is Nothing Then
            WCHOrgMarkStale
        End If
    ElseIf Sh.Name = "WCM Calibration Final" Then
        If Not Application.Intersect(Target, Sh.Range("A11:P2000")) Is Nothing Then
            WCHOrgMarkStale
        End If
    End If
End Sub

Private Sub WCHOrgMarkStale()
    Dim d As Worksheet
    If orgStale Then Exit Sub
    orgStale = True
    managerKeys = Empty
    managerLabels = Empty
    On Error Resume Next
    Set d = ThisWorkbook.Worksheets("Dashboard")
    ' Updating a shape does not dirty workbook formulas, unlike writing a cell.
    d.Shapes(PREFIX & "ui_status").TextFrame2.TextRange.Text = _
        "Org chart is a snapshot. Click Refresh org chart to show the current filters and ratings."
    On Error GoTo 0
End Sub

Private Sub WCHOrgUpdate()
    Dim d As Worksheet, c As Worksheet, raw As Worksheet
    Dim oldEvents As Boolean, oldScreen As Boolean
    Dim reason As String, errText As String
    Dim i As Long, scopeCount As Long, contextCount As Long
    If WCHOrgBusy Then Exit Sub
    WCHOrgBusy = True
    oldEvents = Application.EnableEvents
    oldScreen = Application.ScreenUpdating
    On Error GoTo Failed
    Set d = ThisWorkbook.Worksheets("Dashboard")
    Set c = ThisWorkbook.Worksheets("Calculations")
    Application.EnableEvents = False
    On Error Resume Next
    Set raw = ThisWorkbook.Worksheets("WCM Calibration Final")
    On Error GoTo Failed
    ' Automatic mode already updates the dashboard. Do not repeat three full
    ' sheet calculations after every filter. Explicit refresh in Manual mode
    ' calculates the dependent sheets, without changing the global mode.
    If Application.Calculation <> xlCalculationAutomatic Or Application.CalculationState <> xlDone Then
        If Not raw Is Nothing Then raw.Calculate
        c.Calculate
        d.Calculate
    End If
    Application.ScreenUpdating = False
    PrepareCanvas d
    If raw Is Nothing Then
        reason = "Copy WCM Calibration Final into this workbook, then select Refresh org chart."
    ElseIf SafeText(c.Range("EL2").Value2) <> "Ready" Then
        reason = SafeText(c.Range("EL2").Value2)
    ElseIf Val(SafeText(c.Range("AG8").Value2)) <> 0 Then
        reason = "Choose All or a current value in Product, Manager and Below direct."
    End If
    If Len(reason) > 0 Then
        ShowStatus d, reason
        orgStale = True
        GoTo Finished
    End If
    LoadPeople c, raw
    BuildTree c
    For i = 1 To personCount
        If people(i).Included Then
            If people(i).InScope Then
                scopeCount = scopeCount + 1
            ElseIf people(i).SourceRow > 0 Then
                contextCount = contextCount + 1
            End If
        End If
    Next i
    If scopeCount <> CLng(c.Range("AG4").Value2) Then
        Err.Raise vbObjectError + 1501, "Org chart", "Displayed population does not match the dashboard. Recalculate and check the source."
    End If
    BuildCaptions
    MeasureTree rootIndex, 0
    PositionTree rootIndex, d.Range("AF15").Left, d.Range("AF15").Top
    ' Expose enough empty columns for the complete diagram, never hide a branch.
    Dim lastColumn As Long
    lastColumn = 32 + CLng((people(rootIndex).TreeWidth + 60) / d.Columns("AF").Width) + 2
    If lastColumn > d.Columns.Count Then Err.Raise vbObjectError + 1502, "Org chart", "The tree exceeds the sheet width. Select a manager to focus the view."
    If Not TreeIsHidden(d) Then d.Range(d.Columns(32), d.Columns(lastColumn)).EntireColumn.Hidden = False
    nextShape = 0
    DrawConnections d, rootIndex
    For i = 1 To personCount
        If people(i).Included Then DrawPerson d, i
    Next i
    ShowStatus d, CStr(scopeCount) & " employee records in scope. " & CStr(contextCount) & _
        " roster managers shown for context. Snapshot " & Format$(Now, "hh:nn:ss") & _
        ". Refresh after changing filters or data."
    orgStale = False
Finished:
    ApplyTreeVisibility d, TreeIsHidden(d)
    Application.EnableEvents = oldEvents
    Application.ScreenUpdating = oldScreen
    WCHOrgBusy = False
    Exit Sub
Failed:
    errText = Err.Description
    On Error Resume Next
    If Not d Is Nothing Then
        DeleteTreeShapes d
        ShowStatus d, "Org chart unavailable: " & errText & " Use Refresh org chart after correcting the source."
    End If
    orgStale = True
    Application.EnableEvents = oldEvents
    Application.ScreenUpdating = oldScreen
    WCHOrgBusy = False
    MsgBox "The org chart could not update: " & errText, vbExclamation, "Wealth Calibration Hub"
End Sub

Private Function SafeText(ByVal v As Variant) As String
    If IsError(v) Then
        SafeText = "[source error]"
    ElseIf IsEmpty(v) Or IsNull(v) Then
        SafeText = vbNullString
    Else
        SafeText = Trim$(CStr(v))
    End If
End Function

Private Function AddPerson(ByVal key As String, ByVal personName As String) As Long
    personCount = personCount + 1
    If personCount > MAX_NODES Then Err.Raise vbObjectError + 1503, "Org chart", "Too many organisation nodes."
    people(personCount).Key = key
    people(personCount).PersonName = personName
    people(personCount).IsVirtual = True
    AddPerson = personCount
End Function

Private Function FindPerson(ByVal key As String) As Long
    Dim i As Long
    For i = 1 To personCount
        If StrComp(people(i).Key, key, vbTextCompare) = 0 Then
            FindPerson = i
            Exit Function
        End If
    Next i
End Function

Private Function RatingText(ByVal v As Variant) As String
    Dim n As Double
    RatingText = "Pending"
    If IsError(v) Or IsEmpty(v) Then Exit Function
    If Not IsNumeric(v) Then Exit Function
    n = CDbl(v)
    If n >= 1 And n <= 5 And n = Fix(n) Then RatingText = CStr(CLng(n))
End Function

Private Sub LoadPeople(ByVal c As Worksheet, ByVal raw As Worksheet)
    Dim r As Long, n As Long, sourceRow As Long, key As String
    Dim helpers As Variant, indexes As Variant, scopes As Variant, data As Variant
    ReDim people(1 To MAX_NODES)
    personCount = 0
    managerKeys = c.Range("DQ11:DQ512").Value2
    managerLabels = c.Range("DB11:DB512").Value2
    helpers = c.Range("HE13:HL512").Value2
    indexes = c.Range("EM13:EM512").Value2
    scopes = c.Range("BN13:BP512").Value2
    data = raw.Range("A1:P2000").Value2
    For r = 1 To UBound(indexes, 1)
        sourceRow = CLng(Val(SafeText(indexes(r, 1))))
        If sourceRow >= 12 And sourceRow <= 2000 Then
            key = SafeText(helpers(r, 1))
            If Val(SafeText(helpers(r, 8))) <> 0 Then key = "!ROW:" & CStr(sourceRow)
            n = AddPerson(key, SafeText(data(sourceRow, 2)))
            If people(n).PersonName = vbNullString Then people(n).PersonName = "Employee at source row " & CStr(sourceRow)
            people(n).SourceRow = sourceRow
            people(n).ParentKey = SafeText(helpers(r, 2))
            people(n).JobTitle = SafeText(data(sourceRow, 7))
            people(n).Ratings = "What: " & RatingText(data(sourceRow, 11)) & "    How: " & RatingText(data(sourceRow, 12))
            people(n).IsVirtual = False
            people(n).Unresolved = (Val(SafeText(helpers(r, 8))) <> 0)
            people(n).InScope = (Val(SafeText(scopes(r, 1))) = 1)
        End If
    Next r
    ' Missing managers remain explicit context nodes, not invented employees.
    Dim rosterCount As Long, p As Long, parentName As String
    rosterCount = personCount
    For n = 1 To rosterCount
        If Not people(n).Unresolved And Len(people(n).ParentKey) > 0 Then
            p = FindPerson(people(n).ParentKey)
            If p = 0 Then
                parentName = SafeText(data(people(n).SourceRow, 5))
                If Len(parentName) = 0 Then parentName = people(n).ParentKey
                p = AddPerson(people(n).ParentKey, parentName)
                people(p).JobTitle = "Manager outside this roster"
                people(p).Ratings = "What / How: not in roster"
            End If
            people(n).ParentIndex = p
        End If
    Next n
End Sub

Private Sub BuildTree(ByVal c As Worksheet)
    Dim managerKey As String, belowKey As String
    Dim i As Long, p As Long, steps As Long, unresolvedRoot As Long
    managerKey = SafeText(c.Range("EF2").Value2)
    belowKey = SafeText(c.Range("EF3").Value2)
    If managerKey = "All" Then
        rootIndex = AddPerson("!ORG_ROOT", "Reporting organisation")
        people(rootIndex).JobTitle = "All managers in the selected product scope"
    Else
        rootIndex = FindPerson(managerKey)
        If rootIndex = 0 Then Err.Raise vbObjectError + 1504, "Org chart", "Selected manager cannot be resolved."
    End If
    people(rootIndex).Included = True
    people(rootIndex).ParentIndex = 0
    If belowKey <> "All" Then
        p = FindPerson(belowKey)
        If p = 0 Then Err.Raise vbObjectError + 1505, "Org chart", "Selected Below direct cannot be resolved."
        people(p).Included = True
    End If
    For i = 1 To personCount
        If people(i).InScope Then people(i).Included = True
    Next i
    ' Add context ancestors so a product filter never breaks visible reporting lines.
    For i = 1 To personCount
        If people(i).Included And i <> rootIndex Then
            If people(i).Unresolved Then
                If unresolvedRoot = 0 Then
                    unresolvedRoot = AddPerson("!ORG_UNRESOLVED", "Unresolved reporting relationships")
                    people(unresolvedRoot).JobTitle = "Records retained; no reporting relationship inferred"
                    people(unresolvedRoot).Included = True
                    people(unresolvedRoot).ParentIndex = rootIndex
                End If
                people(i).ParentIndex = unresolvedRoot
            Else
                p = i
                steps = 0
                Do While p <> rootIndex
                    steps = steps + 1
                    If steps > 22 Then Err.Raise vbObjectError + 1506, "Org chart", "Unresolved reporting cycle or depth."
                    people(p).Included = True
                    If people(p).ParentIndex = 0 Then people(p).ParentIndex = rootIndex
                    p = people(p).ParentIndex
                Loop
            End If
        End If
    Next i
    For i = 1 To personCount
        If people(i).Included And i <> rootIndex Then
            p = people(i).ParentIndex
            If p < 1 Or p = i Then Err.Raise vbObjectError + 1507, "Org chart", "Invalid reporting connection."
            people(p).ChildCount = people(p).ChildCount + 1
        End If
    Next i
End Sub

Private Function Wrapped(ByVal s As String, ByVal width As Long) As String
    Dim result As String, line As String, word As Variant
    s = Replace(Replace(s, vbCr, " "), vbLf, " ")
    For Each word In Split(s, " ")
        If Len(CStr(word)) > 0 Then
            If Len(line) > 0 And Len(line) + Len(CStr(word)) + 1 > width Then
                result = result & line & vbLf
                line = vbNullString
            End If
            Do While Len(CStr(word)) > width
                If Len(line) > 0 Then result = result & line & vbLf
                result = result & Left$(CStr(word), width) & vbLf
                word = Mid$(CStr(word), width + 1)
                line = vbNullString
            Loop
            If Len(line) > 0 Then line = line & " "
            line = line & CStr(word)
        End If
    Next word
    Wrapped = result & line
End Function

Private Sub BuildCaptions()
    Dim i As Long, s As String, note As String
    For i = 1 To personCount
        If people(i).Included Then
            note = vbNullString
            If people(i).Unresolved Then
                note = "Reporting link unresolved"
            ElseIf people(i).SourceRow > 0 And Not people(i).InScope Then
                note = "Context - excluded from KPI population"
            ElseIf people(i).ChildCount > 0 Then
                note = CStr(people(i).ChildCount) & " visible direct reports"
            End If
            s = Wrapped(people(i).PersonName, 30)
            If Len(people(i).JobTitle) > 0 Then s = s & vbLf & Wrapped(people(i).JobTitle, 36)
            If Len(people(i).Ratings) > 0 Then s = s & vbLf & people(i).Ratings
            If Len(note) > 0 Then s = s & vbLf & note
            people(i).Caption = s
            people(i).CardHeight = 24 + (UBound(Split(s, vbLf)) + 1) * 17
            If people(i).CardHeight < 106 Then people(i).CardHeight = 106
        End If
    Next i
End Sub

Private Sub MeasureTree(ByVal n As Long, ByVal depth As Long)
    Dim j As Long, sumWidth As Double, maxHeight As Double, stackedHeight As Double
    Dim allLeaves As Boolean
    If depth > 23 Or people(n).VisitState = 1 Then Err.Raise vbObjectError + 1508, "Org chart", "Cycle found during layout."
    people(n).VisitState = 1
    people(n).TreeWidth = CARD_WIDTH
    people(n).TreeHeight = people(n).CardHeight
    allLeaves = True
    For j = 1 To personCount
        If people(j).Included And people(j).ParentIndex = n Then
            MeasureTree j, depth + 1
            If people(j).ChildCount > 0 Then allLeaves = False
            sumWidth = sumWidth + people(j).TreeWidth + X_GAP
            If people(j).TreeHeight > maxHeight Then maxHeight = people(j).TreeHeight
            stackedHeight = stackedHeight + people(j).CardHeight + STACK_GAP
        End If
    Next j
    If people(n).ChildCount > 0 Then
        ' Long sibling lists stack within one branch, with no pagination or limit of six.
        people(n).StackLeaves = allLeaves And people(n).ChildCount > 3
        If people(n).StackLeaves Then
            people(n).TreeWidth = CARD_WIDTH + X_GAP
            people(n).TreeHeight = people(n).CardHeight + Y_GAP + stackedHeight - STACK_GAP
        Else
            people(n).TreeWidth = sumWidth - X_GAP
            If people(n).TreeWidth < CARD_WIDTH Then people(n).TreeWidth = CARD_WIDTH
            people(n).TreeHeight = people(n).CardHeight + Y_GAP + maxHeight
        End If
    End If
    people(n).VisitState = 2
End Sub

Private Sub PositionTree(ByVal n As Long, ByVal areaX As Double, ByVal areaY As Double)
    Dim j As Long, childX As Double, childY As Double
    people(n).PosX = areaX + (people(n).TreeWidth - CARD_WIDTH) / 2
    people(n).PosY = areaY
    childX = areaX
    childY = areaY + people(n).CardHeight + Y_GAP
    For j = 1 To personCount
        If people(j).Included And people(j).ParentIndex = n Then
            If people(n).StackLeaves Then
                PositionTree j, areaX + X_GAP, childY
                childY = childY + people(j).CardHeight + STACK_GAP
            Else
                PositionTree j, childX, childY
                childX = childX + people(j).TreeWidth + X_GAP
            End If
        End If
    Next j
End Sub

Private Sub DrawLine(ByVal d As Worksheet, ByVal x1 As Double, ByVal y1 As Double, ByVal x2 As Double, ByVal y2 As Double)
    Dim s As Shape
    If Abs(x2 - x1) + Abs(y2 - y1) < 0.01 Then Exit Sub
    Set s = d.Shapes.AddLine(CSng(x1), CSng(y1), CSng(x2), CSng(y2))
    nextShape = nextShape + 1
    s.Name = PREFIX & "line_" & CStr(nextShape)
    s.Line.ForeColor.RGB = RGB(155, 181, 220)
    s.Line.Weight = 1.5
    s.Placement = xlFreeFloating
End Sub

Private Sub DrawConnections(ByVal d As Worksheet, ByVal n As Long)
    Dim j As Long, x As Double, y As Double, branchY As Double, childX As Double, busX As Double
    Dim firstX As Double, lastX As Double, lastY As Double, found As Boolean
    x = people(n).PosX + CARD_WIDTH / 2
    y = people(n).PosY + people(n).CardHeight
    branchY = y + Y_GAP / 2
    For j = 1 To personCount
        If people(j).Included And people(j).ParentIndex = n Then
            childX = people(j).PosX + CARD_WIDTH / 2
            If Not found Then firstX = childX
            lastX = childX
            lastY = people(j).PosY + people(j).CardHeight / 2
            busX = people(j).PosX - X_GAP / 2
            found = True
        End If
    Next j
    If found Then
        DrawLine d, x, y, x, branchY
        If people(n).StackLeaves Then
            DrawLine d, x, branchY, busX, branchY
            DrawLine d, busX, branchY, busX, lastY
        Else
            DrawLine d, firstX, branchY, lastX, branchY
        End If
    End If
    For j = 1 To personCount
        If people(j).Included And people(j).ParentIndex = n Then
            If people(n).StackLeaves Then
                DrawLine d, busX, people(j).PosY + people(j).CardHeight / 2, people(j).PosX, people(j).PosY + people(j).CardHeight / 2
            Else
                childX = people(j).PosX + CARD_WIDTH / 2
                DrawLine d, childX, branchY, childX, people(j).PosY
            End If
            DrawConnections d, j
        End If
    Next j
End Sub

Private Sub DrawPerson(ByVal d As Worksheet, ByVal n As Long)
    Dim s As Shape, fillColor As Long, ink As Long, firstLength As Long
    fillColor = RGB(255, 255, 255): ink = RGB(23, 53, 95)
    If Not people(n).InScope Then fillColor = RGB(237, 242, 249)
    If n = rootIndex Then fillColor = RGB(23, 53, 95): ink = RGB(255, 255, 255)
    If people(n).Unresolved Then fillColor = RGB(250, 244, 231)
    Set s = d.Shapes.AddShape(msoShapeRoundedRectangle, CSng(people(n).PosX), CSng(people(n).PosY), CSng(CARD_WIDTH), CSng(people(n).CardHeight))
    s.Name = PREFIX & "node_" & CStr(n)
    s.AlternativeText = people(n).Key
    s.Fill.ForeColor.RGB = fillColor
    s.Line.ForeColor.RGB = RGB(220, 228, 238)
    s.Line.Weight = 1
    s.Adjustments.Item(1) = 0.08
    s.Placement = xlFreeFloating
    With s.TextFrame2
        .MarginLeft = 12: .MarginRight = 12: .MarginTop = 10: .MarginBottom = 10
        .WordWrap = msoTrue
        .AutoSize = msoAutoSizeNone
        .VerticalAnchor = msoAnchorMiddle
        .TextRange.Text = people(n).Caption
        .TextRange.Font.Name = FONT_NAME
        .TextRange.Font.Size = 10
        .TextRange.Font.Fill.ForeColor.RGB = ink
        .TextRange.ParagraphFormat.Alignment = msoAlignLeft
        .TextRange.ParagraphFormat.SpaceAfter = 0
        firstLength = Len(Wrapped(people(n).PersonName, 30))
        .TextRange.Characters(1, firstLength).Font.Bold = msoTrue
        .TextRange.Characters(1, firstLength).Font.Size = 12
    End With
    If people(n).ChildCount > 0 Then
        If ManagerLabel(people(n).Key) <> vbNullString Then s.OnAction = MacroName("WCHOrgFocus")
    End If
End Sub

Private Function MacroName(ByVal procedure As String) As String
    MacroName = "'" & Replace(ThisWorkbook.Name, "'", "''") & "'!" & procedure
End Function

Private Function ManagerLabel(ByVal key As String) As String
    Dim i As Long
    If Not IsArray(managerKeys) Then
        With ThisWorkbook.Worksheets("Calculations")
            managerKeys = .Range("DQ11:DQ512").Value2
            managerLabels = .Range("DB11:DB512").Value2
        End With
    End If
    For i = 1 To UBound(managerKeys, 1)
        If StrComp(SafeText(managerKeys(i, 1)), key, vbTextCompare) = 0 Then
            ManagerLabel = SafeText(managerLabels(i, 1))
            Exit Function
        End If
    Next i
End Function

Public Sub WCHOrgFocus()
    Dim key As String, label As String
    On Error GoTo Failed
    managerKeys = Empty
    key = ThisWorkbook.Worksheets("Dashboard").Shapes(CStr(Application.Caller)).AlternativeText
    label = ManagerLabel(key)
    If Len(label) = 0 Then Exit Sub
    SelectManager label
    Exit Sub
Failed:
    MsgBox "Select a manager in the dropdown, then use Refresh org chart.", vbInformation
End Sub

Private Sub SelectManager(ByVal label As String)
    Dim oldEvents As Boolean
    oldEvents = Application.EnableEvents
    On Error GoTo Failed
    Application.EnableEvents = False
    With ThisWorkbook.Worksheets("Dashboard")
        If SafeText(.Range("AF7").Value2) <> "All" Then .Range("AF7").Value2 = "All"
        If SafeText(.Range("N7").Value2) <> label Then .Range("N7").Value2 = label
    End With
    Application.EnableEvents = oldEvents
    WCHOrgMarkStale
    Exit Sub
Failed:
    Application.EnableEvents = oldEvents
    MsgBox Err.Description, vbExclamation, "Org chart filter"
End Sub

Public Sub WCHOrgAllManagers()
    SelectManager "All"
End Sub

Public Sub WCHOrgUp()
    Dim c As Worksheet, d As Worksheet, key As String, label As String, i As Long
    Set c = ThisWorkbook.Worksheets("Calculations")
    managerKeys = Empty
    Set d = ThisWorkbook.Worksheets("Dashboard")
    If SafeText(d.Range("AF7").Value2) <> "All" Then
        d.Range("AF7").Value2 = "All"
        Exit Sub
    End If
    key = SafeText(c.Range("EF2").Value2)
    For i = 13 To 512
        If SafeText(c.Cells(i, "HE").Value2) = key Then
            label = ManagerLabel(SafeText(c.Cells(i, "HF").Value2))
            Exit For
        End If
    Next i
    If Len(label) = 0 Then label = "All"
    SelectManager label
End Sub

Private Sub DeleteTreeShapes(ByVal d As Worksheet)
    Dim i As Long, name As String
    For i = d.Shapes.Count To 1 Step -1
        name = d.Shapes(i).Name
        If Left$(name, Len(PREFIX) + 5) = PREFIX & "node_" Or _
           Left$(name, Len(PREFIX) + 5) = PREFIX & "line_" Then d.Shapes(i).Delete
    Next i
End Sub

Private Sub PrepareCanvas(ByVal d As Worksheet)
    Dim i As Long, name As String
    Dim status As Shape
    Dim wasHidden As Boolean
    wasHidden = TreeIsHidden(d)
    DeleteTreeShapes d
    If canvasReady Then Exit Sub
    ' Replace only the original v14 org panel and its page control.
    For i = d.Shapes.Count To 1 Step -1
        name = d.Shapes(i).Name
        If Left$(name, 4) = "Org " Or Left$(name, Len(PREFIX)) = PREFIX Then d.Shapes(i).Delete
    Next i
    With d.Range("AF11:AU62")
        .UnMerge
        .ClearContents
        .Validation.Delete
        .Interior.Color = RGB(245, 247, 251)
        .Font.Name = FONT_NAME
    End With
    d.Range("AF11:AM12").Merge
    d.Range("AF11").Value2 = "Organisation chart"
    d.Range("AF11").Font.Size = 16
    d.Range("AF11").Font.Color = RGB(23, 53, 95)
    d.Range("AF13:AU14").Merge
    d.Range("AF13").WrapText = True
    d.Range("AF13").Font.Size = 10
    d.Range("AF13").Font.Color = RGB(97, 112, 131)
    Set status = d.Shapes.AddTextbox(msoTextOrientationHorizontal, CSng(d.Range("AF13").Left), _
        CSng(d.Range("AF13").Top), CSng(d.Range("AF13:AU14").Width), CSng(d.Range("AF13:AU14").Height))
    status.Name = PREFIX & "ui_status"
    status.Fill.Visible = msoFalse
    status.Line.Visible = msoFalse
    status.Placement = xlFreeFloating
    With status.TextFrame2
        .MarginLeft = 0: .MarginRight = 0: .MarginTop = 0: .MarginBottom = 0
        .WordWrap = msoTrue
        .TextRange.Font.Name = FONT_NAME
        .TextRange.Font.Size = 10
        .TextRange.Font.Fill.ForeColor.RGB = RGB(97, 112, 131)
    End With
    d.Range("AF4:AU5").Value2 = "Product > Manager > Below direct. Filters update the dashboard. Click Refresh org chart to rebuild the tree."
    AddButton d, "Refresh org chart", d.Range("AN11").Left, d.Range("AN11").Top, 118, "WCHOrgRefresh"
    AddButton d, "Up", d.Range("AN11").Left + 124, d.Range("AN11").Top, 40, "WCHOrgUp"
    AddButton d, "All managers", d.Range("AN11").Left + 170, d.Range("AN11").Top, 88, "WCHOrgAllManagers"
    ' Remove only the obsolete org-pagination instruction in the existing note.
    d.Range("B200").Value2 = "Select Product, Manager and Below direct. Click Refresh org chart after changing filters or data. The tree is a snapshot of all selected reporting levels without pages. Context managers are excluded from KPI counts. Unresolved reporting relationships are marked."
    EnsureVisibilityButton d
    ApplyTreeVisibility d, wasHidden
    canvasReady = True
End Sub

Private Sub AddButton(ByVal d As Worksheet, ByVal label As String, ByVal x As Double, ByVal y As Double, ByVal width As Double, ByVal action As String)
    Dim s As Shape
    Set s = d.Shapes.AddShape(msoShapeRoundedRectangle, CSng(x), CSng(y), CSng(width), 26)
    s.Name = PREFIX & "button_" & action
    s.OnAction = MacroName(action)
    s.Fill.ForeColor.RGB = RGB(237, 242, 249)
    s.Line.ForeColor.RGB = RGB(220, 228, 238)
    s.Adjustments.Item(1) = 0.08
    s.Placement = xlFreeFloating
    With s.TextFrame2
        .TextRange.Text = label
        .TextRange.Font.Name = FONT_NAME
        .TextRange.Font.Size = 10
        .TextRange.Font.Fill.ForeColor.RGB = RGB(23, 53, 95)
        .TextRange.ParagraphFormat.Alignment = msoAlignCenter
        .VerticalAnchor = msoAnchorMiddle
    End With
End Sub

Private Sub ShowStatus(ByVal d As Worksheet, ByVal message As String)
    d.Shapes(PREFIX & "ui_status").TextFrame2.TextRange.Text = message
End Sub

' Visibility applies only to generated people and connectors, never other charts.
' The button stores the choice in the workbook so refresh/reopen preserves it.
Private Function TreeIsHidden(ByVal d As Worksheet) As Boolean
    On Error Resume Next
    TreeIsHidden = (d.Shapes(PREFIX & "button_WCHOrgToggle").AlternativeText = "tree-hidden")
    On Error GoTo 0
End Function

Private Sub EnsureVisibilityButton(ByVal d As Worksheet)
    Dim s As Shape
    On Error Resume Next
    Set s = d.Shapes(PREFIX & "button_WCHOrgToggle")
    On Error GoTo 0
    If s Is Nothing Then
        AddButton d, "Hide tree", d.Range("AN11").Left + 264, d.Range("AN11").Top, 82, "WCHOrgToggle"
    End If
End Sub

Private Sub ApplyTreeVisibility(ByVal d As Worksheet, ByVal hideTree As Boolean)
    Dim s As Shape, visibility As Long
    EnsureVisibilityButton d
    If hideTree Then
        visibility = msoFalse
    Else
        visibility = msoTrue
    End If
    For Each s In d.Shapes
        If Left$(s.Name, Len(PREFIX) + 5) = PREFIX & "node_" Or _
           Left$(s.Name, Len(PREFIX) + 5) = PREFIX & "line_" Then
            s.Visible = visibility
        End If
    Next s
    With d.Shapes(PREFIX & "button_WCHOrgToggle")
        .Visible = msoTrue
        If hideTree Then
            .AlternativeText = "tree-hidden"
            .TextFrame2.TextRange.Text = "Show tree"
        Else
            .AlternativeText = "tree-visible"
            .TextFrame2.TextRange.Text = "Hide tree"
        End If
    End With
End Sub

Public Sub WCHOrgHide()
    SetTreeVisibility True
End Sub

Public Sub WCHOrgShow()
    SetTreeVisibility False
End Sub

Public Sub WCHOrgToggle()
    SetTreeVisibility Not TreeIsHidden(ThisWorkbook.Worksheets("Dashboard"))
End Sub

Private Sub SetTreeVisibility(ByVal hideTree As Boolean)
    Dim oldScreen As Boolean
    If WCHOrgBusy Then Exit Sub
    oldScreen = Application.ScreenUpdating
    On Error GoTo Failed
    Application.ScreenUpdating = False
    ApplyTreeVisibility ThisWorkbook.Worksheets("Dashboard"), hideTree
    Application.ScreenUpdating = oldScreen
    Exit Sub
Failed:
    Application.ScreenUpdating = oldScreen
    MsgBox "Org chart visibility could not change: " & Err.Description, vbExclamation
End Sub
