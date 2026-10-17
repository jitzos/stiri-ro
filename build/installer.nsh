!include "LogicLib.nsh"
!include "nsDialogs.nsh"

Var StartAtLoginCheckbox
Var StartAtLoginChoice
Var ExistingInstall

!macro customPageAfterChangeDir
  Page custom StartAtLoginPageCreate StartAtLoginPageLeave
!macroend

Function StartAtLoginPageCreate
  IfSilent 0 +2
    Abort

  StrCpy $ExistingInstall "0"
  ${If} ${FileExists} "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
    StrCpy $ExistingInstall "1"
    Abort
  ${EndIf}

  !insertmacro MUI_HEADER_TEXT "Opțiuni de pornire" "Alege cum pornește Știri RO."
  nsDialogs::Create 1018
  Pop $0
  ${If} $0 == error
    Abort
  ${EndIf}

  ${NSD_CreateLabel} 0 0 100% 28u "Știri RO poate porni automat, ascunsă în zona de notificări, când te conectezi la Windows."
  Pop $0
  ${NSD_CreateCheckbox} 0 40u 100% 14u "Pornește Știri RO când mă conectez la Windows"
  Pop $StartAtLoginCheckbox
  ${NSD_Uncheck} $StartAtLoginCheckbox

  nsDialogs::Show
FunctionEnd

Function StartAtLoginPageLeave
  ${NSD_GetState} $StartAtLoginCheckbox $StartAtLoginChoice
FunctionEnd

!macro customInstall
  ${If} $ExistingInstall != "1"
    ${IfNot} ${Silent}
      ${If} $StartAtLoginChoice == ${BST_CHECKED}
        WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "${PRODUCT_NAME}" "$\"$INSTDIR\${APP_EXECUTABLE_FILENAME}$\" --hidden"
      ${Else}
        DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "${PRODUCT_NAME}"
      ${EndIf}
    ${EndIf}
  ${EndIf}
!macroend

!macro customUnInstall
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "${PRODUCT_NAME}"
!macroend
