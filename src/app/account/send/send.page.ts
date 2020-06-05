import { Component, ViewChild, NgZone, OnInit } from '@angular/core'
import { Platform } from '@ionic/angular'
import { MetaverseService } from 'src/app/services/metaverse.service'
import { TranslateService } from '@ngx-translate/core'
import { AppService } from 'src/app/services/app.service'
import { ActivatedRoute, Router } from '@angular/router'
import { Location } from '@angular/common'
import { AlertService } from 'src/app/services/alert.service'

class RecipientSendMore {
  constructor(
    public address: string,
    public avatar: string,
    public target: any,
    public attenuation_model: string
  ) { }
}

export const deeplinkRegex = /^.*app\.myetpwallet\.com\/send\/(.+)\?(.*)$/
@Component({
  selector: 'app-send',
  templateUrl: './send.page.html',
  styleUrls: ['./send.page.scss'],
})
export class SendPage implements OnInit {


  selectedAsset: any
  addresses: Array<string>
  balance: number
  decimals: number
  showBalance: number
  recipient_address: string
  recipient_avatar: string
  recipient_avatar_valid: boolean
  quantity: string = ""
  addressbalances: Array<any>
  sendFrom: string = "auto"
  changeAddress: string
  feeAddress: string = "auto"
  etpBalance: number
  @ViewChild('recipientAddressInput') recipientAddressInput;
  @ViewChild('quantityInput') quantityInput;
  transfer_type: string = "one"
  recipients: Array<RecipientSendMore> = []
  total_to_send: any = {}
  sendMoreValidQuantity: boolean = false
  sendMoreValidAddress: boolean = false
  sendMore_limit: number = 1000
  total: number
  message: string = ""
  fee: number
  defaultFee: number
  sendMoreValidEachAvatar: Array<boolean> = []
  attenuation_model: string
  lock: boolean = false
  isApp: boolean
  showAdvanced: boolean = false
  locktime: number
  addressbalancesObject: any = {}
  base: string
  tickers = {}
  disableParams = false
  params = {}
  sendToAvatar = false

  constructor(
    private metaverseService: MetaverseService,
    public platform: Platform,
    private alertService: AlertService,
    // private barcodeScanner: BarcodeScanner,
    // private keyboard: Keyboard,
    private translate: TranslateService,
    private zone: NgZone,
    private appService: AppService,
    private activatedRoute: ActivatedRoute,
    private location: Location,
    private router: Router,
  ) {

    this.selectedAsset = this.activatedRoute.snapshot.params.symbol
    this.initializeParameters(this.selectedAsset, this.activatedRoute.snapshot.paramMap)

    if (this.selectedAsset == 'ETP') {
      this.recipients.push(new RecipientSendMore('', '', { "ETP": undefined }, undefined))
    } else {
      this.recipients.push(new RecipientSendMore('', '', { "MST": { [this.selectedAsset]: undefined } }, undefined))
    }
    this.total_to_send[this.selectedAsset] = 0
    this.total = 0
    this.isApp = (!document.URL.startsWith('http') || document.URL.startsWith('http://localhost:8080'));

    //Load addresses and balances
    Promise.all([this.metaverseService.getBalances(), this.metaverseService.getAddresses(), this.metaverseService.getAddressBalances()])
      .then(([balances, addresses, addressbalancesObject]) => {
        let balance = (this.selectedAsset == 'ETP') ? balances.ETP : balances.MST[this.selectedAsset]
        this.balance = (balance && balance.available) ? balance.available : 0
        this.decimals = balance.decimals
        this.etpBalance = balances.ETP.available
        this.showBalance = this.balance
        this.addresses = addresses
        this.addressbalancesObject = addressbalancesObject

        let addrblncs = []
        Object.keys(addresses).forEach((index) => {
          let address = addresses[index]
          if (addressbalancesObject[address]) {
            addrblncs.push({ "address": address, "avatar": addressbalancesObject[address].AVATAR ? addressbalancesObject[address].AVATAR : "", "identifier": addressbalancesObject[address].AVATAR ? addressbalancesObject[address].AVATAR : address, "balance": this.selectedAsset == 'ETP' ? addressbalancesObject[address].ETP.available : addressbalancesObject[address].MST[this.selectedAsset] ? addressbalancesObject[address].MST[this.selectedAsset].available : 0 })
          } else {
            addrblncs.push({ "address": address, "avatar": "", "identifier": address, "balance": 0 })
          }
        })
        this.addressbalances = addrblncs
      })

    this.fee = this.appService.default_fees.default
    this.defaultFee = this.fee
    this.metaverseService.getFees()
      .then(fees => {
        this.fee = fees.default
        this.defaultFee = this.fee
      })
  }

  ngOnInit() {

  }

  initializeParameters(asset: string, params: { get(param: string): any }) {
    if (this.selectedAsset !== asset) {
      this.alertService.showErrorTranslated('ERROR_SCAN_ASSET_NOT_MATCH_TITLE', 'ERROR_SCAN_ASSET_NOT_MATCH_MESSAGE')
    } else {
      this.quantity = params.get('q') || params.get('quantity') || params.get('amount') || ''
      this.recipient_address = params.get('r') || params.get('recipient') || ''
      this.recipient_avatar = params.get('a') || params.get('avatar') || ''
      this.message = params.get('m') || params.get('message') || ''
      this.disableParams = params.get('d') == 'true' || params.get('disableParams') == 'true'

      if (this.recipient_avatar !== "") {
        this.sendToAvatar = true
        this.recipientAvatarChanged()
      }
      this.params['amount'] = this.quantity !== ""
      this.params['recipient_address'] = this.recipient_address !== ""
      this.params['recipient_avatar'] = this.recipient_avatar !== ""
      this.params['message'] = this.message !== ""
    }
  }


  ionViewDidEnter() {
    this.metaverseService.getAddresses()
      .then((addresses) => {
        if (!Array.isArray(addresses) || !addresses.length)
          this.navCtrl.setRoot("LoginPage")
      })
    this.loadTickers()
  }

  private async loadTickers() {
    [this.base, this.tickers] = await this.metaverseService.getBaseAndTickers()
  }

  onFromAddressChange(event) {
    if (this.sendFrom == 'auto') {
      this.showBalance = this.balance
    } else {
      if (this.addressbalances.length)
        this.addressbalances.forEach((addressbalance) => {
          if (addressbalance.address == this.sendFrom)
            this.showBalance = addressbalance.balance
        })
    }
  }

  validQuantity = (quantity) => quantity != undefined
    && this.countDecimals(quantity) <= this.decimals
    && ((this.selectedAsset == 'ETP' && this.showBalance >= (Math.round(parseFloat(quantity) * Math.pow(10, this.decimals)) + this.fee)) || (this.selectedAsset != 'ETP' && this.showBalance >= parseFloat(quantity) * Math.pow(10, this.decimals)))
    && (quantity > 0)

  countDecimals(value) {
    if (Math.floor(value) !== value && value.toString().split(".").length > 1)
      return value.toString().split(".")[1].length || 0;
    return 0;
  }

  updateRange() {
    // TODO: What is this code doing?
    this.zone.run(() => { });
  }

  cancel(e) {
    e.preventDefault()
    this.location.back()
  }

  create() {
    return this.alertService.showLoading()
      .then(() => {
        let messages = [];
        if (this.message) {
          messages.push(this.message)
        }
        switch (this.transfer_type) {
          case "one":
            if (this.lock) {
              return this.metaverseService.createAssetDepositTx(
                this.recipient_address,
                (this.recipient_avatar && this.recipient_avatar_valid) ? this.recipient_avatar : undefined,
                this.selectedAsset,
                Math.round(parseFloat(this.quantity) * Math.pow(10, this.decimals)),
                (this.showAdvanced && this.lock) ? this.attenuation_model : undefined,
                (this.sendFrom != 'auto') ? this.sendFrom : null,
                (this.showAdvanced && this.changeAddress != 'auto') ? this.changeAddress : undefined,
                (this.showAdvanced) ? this.fee : this.defaultFee,
                (this.showAdvanced && messages !== []) ? messages : undefined
              )
            } else {
              return this.metaverseService.createSendTx(
                this.selectedAsset,
                this.recipient_address,
                (this.recipient_avatar && this.recipient_avatar_valid) ? this.recipient_avatar : undefined,
                Math.round(parseFloat(this.quantity) * Math.pow(10, this.decimals)),
                (this.sendFrom != 'auto') ? this.sendFrom : null,
                (this.showAdvanced && this.changeAddress != 'auto') ? this.changeAddress : undefined,
                (this.showAdvanced) ? this.fee : this.defaultFee,
                ((this.showAdvanced || this.params['message']) && messages !== []) ? messages : undefined
              )
            }
          case "more":
            let target = {}
            let recipients = JSON.parse(JSON.stringify(this.recipients))
            target[this.selectedAsset] = Math.round(parseFloat(this.total_to_send[this.selectedAsset]) * Math.pow(10, this.decimals))
            recipients.forEach((recipient) => {
              if (this.selectedAsset == 'ETP') {
                recipient.target['ETP'] = Math.round(parseFloat(recipient.target['ETP']) * Math.pow(10, this.decimals))
              } else {
                let convertedQuantity = Math.round(parseFloat(recipient.target['MST'][this.selectedAsset]) * Math.pow(10, this.decimals))
                recipient.target['MST'][this.selectedAsset] = convertedQuantity
                if (this.showAdvanced && this.lock && this.attenuation_model) {
                  recipient.attenuation_model = this.attenuation_model + ';LQ=' + convertedQuantity
                }
              }
            })
            return this.metaverseService.createSendMoreTx(
              target,
              recipients,
              (this.sendFrom != 'auto') ? this.sendFrom : null,
              (this.showAdvanced && this.changeAddress != 'auto') ? this.changeAddress : undefined,
              (this.showAdvanced && messages !== []) ? messages : undefined
            )
          default:
            this.alertService.stopLoading()
            this.alertService.showError('MESSAGE.UNKNOWN_TX_TYPE', '')
            return 0
        }
      })
      .catch((error) => {
        console.error(error.message)
        this.alertService.stopLoading()
        switch (error.message) {
          case "ERR_DECRYPT_WALLET":
            this.alertService.showError('MESSAGE.PASSWORD_WRONG', '')
            throw Error('ERR_CREATE_TX')
          case "ERR_INSUFFICIENT_BALANCE":
            this.alertService.showError('MESSAGE.INSUFFICIENT_BALANCE', '')
            throw Error('ERR_CREATE_TX')
          case "ERR_TOO_MANY_INPUTS":
            this.alertService.showErrorTranslated('ERROR_TOO_MANY_INPUTS', 'ERROR_TOO_MANY_INPUTS_TEXT')
            throw Error('ERR_CREATE_TX')
          default:
            this.alertService.showError('MESSAGE.CREATE_TRANSACTION', error.message)
            throw Error('ERR_CREATE_TX')
        }
      })
  }

  send() {
    this.create()
      .then((result) => {
        this.router.navigate(['account', 'confirm'], { queryParams: { tx: result.encode().toString('hex') } })
        this.alertService.stopLoading()
      })
      .catch((error) => {
        console.error(error)
        this.alertService.stopLoading()
        switch (error.message) {
          case "ERR_CONNECTION":
            this.alertService.showError('ERROR_SEND_TEXT', '')
            break;
          case "ERR_CREATE_TX":
            //already handle in create function
            break;
          default:
            this.alertService.showError('MESSAGE.BROADCAST_ERROR', error.message)
        }
      })
  }

  sendAll = () => this.alertService.showSendAll(() => {
    if (this.selectedAsset == 'ETP') {
      this.quantity = parseFloat(((this.showBalance / 100000000 - this.fee / 100000000).toFixed(this.decimals)) + "") + ""
    } else {
      this.quantity = parseFloat((this.showBalance / Math.pow(10, this.decimals)).toFixed(this.decimals) + "") + ""
    }
    this.quantityInput.setFocus()
  })

  validaddress = this.metaverseService.validAddress

  validAvatar = (input: string) => /[A-Za-z0-9.-]/.test(input) && this.recipient_avatar_valid

  validFromAddress = (address: string) => address == 'auto' || (this.addressbalancesObject[address] && this.addressbalancesObject[address].ETP.available !== 0)

  validSendMoreAvatar = (input: string, index: number) => /[A-Za-z0-9.-]/.test(input) && this.sendMoreValidEachAvatar[index]

  recipientChanged = () => {
    if (this.recipient_address) {
      this.recipient_address = this.recipient_address.trim()
    }
  }

  recipientAvatarChanged = () => {
    if (this.recipient_avatar) {
      this.recipient_avatar = this.recipient_avatar.trim()
      Promise.all([this.metaverseService.getGlobalAvatar(this.recipient_avatar), this.recipient_avatar])
        .then(result => {
          if (this.recipient_avatar != result[1])
            throw ''
          this.recipient_avatar_valid = true
          this.recipient_address = result[0].address
        })
        .catch((e) => {
          this.recipient_avatar_valid = false
          this.recipient_address = ""
        })
    }
  }

  sendMoreRecipientAvatarChanged = (index) => {
    if (this.recipients[index] && this.recipients[index].avatar) {
      this.recipients[index].avatar = this.recipients[index].avatar.trim()
    }
    Promise.all([this.metaverseService.getGlobalAvatar(this.recipients[index].avatar), this.recipients[index].avatar])
      .then(result => {
        if (this.recipients[index].avatar != result[1])
          throw ''
        this.sendMoreValidEachAvatar[index] = true
        this.recipients[index].address = result[0].address
        this.checkSendMoreAddress()
      })
      .catch((e) => {
        this.sendMoreValidEachAvatar[index] = false
        this.recipients[index].address = ""
        this.sendMoreValidAddress = false
      })
  }

  quantityETPChanged = () => {
    let total = 0
    if (this.recipients) {
      this.recipients.forEach((recipient) => total = recipient.target['ETP'] ? total + parseFloat(recipient.target['ETP']) : total)
    }
    this.total_to_send[this.selectedAsset] = +total.toFixed(this.decimals);
    this.total = this.total_to_send[this.selectedAsset] * Math.pow(10, this.decimals);
    this.checkEtpSendMoreQuantity()
  }

  quantityMSTChanged = () => {
    let total = 0
    if (this.recipients) {
      this.recipients.forEach((recipient) => total = recipient.target['MST'][this.selectedAsset] ? total + parseFloat(recipient.target['MST'][this.selectedAsset]) : total)
    }
    this.total_to_send[this.selectedAsset] = +total.toFixed(this.decimals);
    this.total = this.total_to_send[this.selectedAsset] * Math.pow(10, this.decimals);
    this.checkMstSendMoreQuantity()
  }

  checkEtpSendMoreQuantity = () => {
    let valid = true
    this.recipients.forEach((recipient) => {
      if (!recipient.target || !recipient.target['ETP'] || recipient.target['ETP'] <= 0 || this.countDecimals(recipient.target['ETP']) > this.decimals)
        valid = false
    })
    this.sendMoreValidQuantity = valid
  }

  checkMstSendMoreQuantity = () => {
    let valid = true
    this.recipients.forEach((recipient) => {
      if (!recipient.target || !recipient.target['MST'] || !recipient.target['MST'][this.selectedAsset] || recipient.target['MST'][this.selectedAsset] <= 0 || this.countDecimals(recipient.target['MST'][this.selectedAsset]) > this.decimals)
        valid = false
    })
    this.sendMoreValidQuantity = valid
  }

  checkSendMoreAddress = () => {
    let valid = true
    this.recipients.forEach((recipient) => {
      if (!recipient.address || !this.metaverseService.validAddress(recipient.address))
        valid = false
    })
    this.sendMoreValidAddress = valid
  }

  validMessageLength = (message) => this.metaverseService.verifyMessageSize(message) < 253

  scan() {
    // this.translate.get(['SCANNING.MESSAGE_ADDRESS']).subscribe((translations: any) => {
    //   this.barcodeScanner.scan(
    //     {
    //       preferFrontCamera: false,
    //       showFlipCameraButton: false,
    //       showTorchButton: false,
    //       torchOn: false,
    //       prompt: translations['SCANNING.MESSAGE_ADDRESS'],
    //       resultDisplayDuration: 0,
    //       formats: "QR_CODE",
    //     }).then((result) => {
    //       if (!result.cancelled) {
    //         const codeContent = result.text.toString();
    //         if (deeplinkRegex.test(codeContent)) {
    //           const asset = codeContent.match(deeplinkRegex)[1]
    //           const params = new URLSearchParams(codeContent.match(deeplinkRegex)[2])
    //           this.initializeParameters(asset, params)
    //         } else {
    //           let content = result.text.toString().split('&')
    //           if (this.metaverseService.validAddress(content[0]) == true) {
    //             this.recipient_address = content[0]
    //             this.recipientAddressInput.setFocus();
    //             // TODO: Still needed to manually close the keyboard?
    //             // this.keyboard.close()
    //           } else {
    //             this.alertService.showWrongAddress()
    //           }
    //         }
    //       }
    //     })
    // })
  }

  addRecipient() {
    this.sendMoreValidQuantity = false
    this.sendMoreValidAddress = false
    if (this.selectedAsset == 'ETP') {
      this.recipients.push(new RecipientSendMore('', '', { "ETP": undefined }, undefined))
    } else {
      this.recipients.push(new RecipientSendMore('', '', { "MST": { [this.selectedAsset]: undefined } }, undefined))
    }
  }

  removeRecipient(index) {
    this.recipients.splice(index, 1)
    this.sendMoreValidEachAvatar.splice(index, 1)
    if (this.selectedAsset == 'ETP') {
      this.quantityETPChanged()
    } else {
      this.quantityMSTChanged()
    }
    this.checkSendMoreAddress()
  }

  sendMoreAddressChanged(index) {
    if (this.recipients[index] && this.recipients[index].address) {
      this.recipients[index].address = this.recipients[index].address.trim()
      this.recipients[index].avatar = ''
    }
    this.checkSendMoreAddress()
  }

  import(e) {
    this.alertService.showLoading()
      .then(() => {
        setTimeout(() => {
          this.open(e)
        }, 500);
      })
  }

  open(e) {
    let file = e.target.files
    let reader = new FileReader();
    const COLUMN_RECIPIENT_HEADER = 'recipient';
    const COLUMN_AMOUNT_HEADER = 'amount';
    const COLUMN_LOCK_BLOCK_HEADER = 'lock_blocks';
    const COLUMN_LOCK_MODEL_HEADER = 'lock_model';

    let errorLine = 0

    reader.onload = (e: any) => {
      let content = e.target.result;
      try {
        let data = content.split('\n');
        this.recipients = []
        let columnIndex = {}
        data[0].split(',').forEach((columnName, index) => columnIndex[columnName] = index)
        for (let i = 1; i < this.sendMore_limit; i++) {
          if (data[i]) {
            let line = data[i].split(',');
            let recipient = line[columnIndex[COLUMN_RECIPIENT_HEADER]] ? line[columnIndex[COLUMN_RECIPIENT_HEADER]].trim() : line[columnIndex[COLUMN_RECIPIENT_HEADER]]
            let amount = line[columnIndex[COLUMN_AMOUNT_HEADER]] ? line[columnIndex[COLUMN_AMOUNT_HEADER]].trim() : line[columnIndex[COLUMN_AMOUNT_HEADER]]
            if (this.selectedAsset == 'ETP') {
              if (this.validaddress(recipient)) {
                this.recipients.push(new RecipientSendMore(recipient, '', { "ETP": amount }, undefined))
              } else {
                this.recipients.push(new RecipientSendMore('', recipient, { "ETP": amount }, undefined))
                this.sendMoreRecipientAvatarChanged(i - 1)
              }
            } else {
              let attenuation_model = undefined
              if (columnIndex[COLUMN_LOCK_BLOCK_HEADER] && line[columnIndex[COLUMN_LOCK_BLOCK_HEADER]]) {
                if (columnIndex[COLUMN_LOCK_MODEL_HEADER] && line[columnIndex[COLUMN_LOCK_MODEL_HEADER]]) {
                  errorLine = i + 1
                  throw Error('ERR_TWO_LOCK_MODEL')
                }
                let convertedQuantity = Math.round(parseFloat(amount) * Math.pow(10, this.decimals))
                let nbrBlocks = line[columnIndex[COLUMN_LOCK_BLOCK_HEADER]]
                attenuation_model = 'PN=0;LH=' + nbrBlocks + ';TYPE=1;LP=' + nbrBlocks + ';UN=1;LQ=' + convertedQuantity
              } else if (columnIndex[COLUMN_LOCK_MODEL_HEADER] && line[columnIndex[COLUMN_LOCK_MODEL_HEADER]]) {
                attenuation_model = line[columnIndex[COLUMN_LOCK_MODEL_HEADER]]
              }
              if (this.validaddress(recipient)) {
                this.recipients.push(new RecipientSendMore(recipient, '', { "MST": { [this.selectedAsset]: amount } }, attenuation_model))
              } else {
                this.recipients.push(new RecipientSendMore('', recipient, { "MST": { [this.selectedAsset]: amount } }, attenuation_model))
                this.sendMoreRecipientAvatarChanged(i - 1)
              }
            }
          }
        }
        if (data.length > this.sendMore_limit)
          this.alertService.showLimitReached('MESSAGE.SEND_MORE_IMPORT_CSV_TOO_MANY_RECIPIENT_TITLE', 'MESSAGE.SEND_MORE_IMPORT_CSV_TOO_MANY_RECIPIENT_BODY', this.sendMore_limit)
        if (this.selectedAsset == 'ETP') {
          this.quantityETPChanged()
        } else {
          this.quantityMSTChanged()
        }
        this.checkSendMoreAddress()
        this.alertService.stopLoading()
      } catch (error) {
        this.alertService.stopLoading()
        console.error(error.message)
        switch (error.message) {
          case "ERR_TWO_LOCK_MODEL":
            this.alertService.showError('ERROR_TWO_LOCK_MODEL', errorLine)
            throw Error('ERR_IMPORT_CSV')
          default:
            this.alertService.showMessage('WRONG_FILE', '', 'SEND_MORE.WRONG_FILE')
            throw Error('ERR_IMPORT_CSV')
        }
      }
    };
    if (file[0])
      reader.readAsText(file[0]);
  }

  download() {
    var text = ''
    var filename = 'recipients.csv'
    let header = 'recipient' + ',' + 'amount'
    if (this.showAdvanced && this.lock && this.attenuation_model) {
      header += ',' + 'lock_blocks'
    }
    header += '\n'
    text += header
    this.recipients.forEach((recipient) => {
      let line = recipient.address + ','
      if (recipient.target['ETP']) {
        line += recipient.target['ETP']
      } else if (recipient.target['MST'] && recipient.target['MST'][this.selectedAsset]) {
        line += recipient.target['MST'][this.selectedAsset]
      }
      if (this.showAdvanced && this.lock && this.attenuation_model) {
        line += ',' + this.locktime
      }
      line += '\n'
      text += line
    })
    this.downloadFile(filename, text)
  }

  csvExample() {
    var text = 'recipient' + ',' + 'amount' + ',' + 'lock_blocks' + ',' + 'lock_model' + '\n'
    text += 'MAwLwVGwJyFsTBfNj2j5nCUrQXGVRvHzPh,2,10,\n'
    text += 'MEWdqvhETJex22kBbYDSD999Vs4xFwQ4fo,2,,PN=0;LH=20;TYPE=1;LP=20;UN=1;LQ=2\n'
    text += 'avatar-name,4';
    var filename = 'mvs_example.csv'
    this.downloadFile(filename, text)
  }

  downloadFile(filename, text) {
    var pom = document.createElement('a');
    pom.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    pom.setAttribute('download', filename);

    if (document.createEvent) {
      var event = document.createEvent('MouseEvents');
      event.initEvent('click', true, true);
      pom.dispatchEvent(event);
    }
    else {
      pom.click();
    }
  }

  setAttenuationModel = (output: any) => {
    this.attenuation_model = output.attenuation_model
    this.locktime = output.locktime
  }

}