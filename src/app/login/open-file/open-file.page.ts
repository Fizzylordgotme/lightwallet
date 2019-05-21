import { Component, OnInit } from '@angular/core';
import { LoadingController, AlertController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { WalletService } from 'src/app/services/wallet.service';
import { MetaverseService } from '../../services/metaverse.service';
import { Router } from '@angular/router';
import { FormGroup, FormControl, Validators, FormBuilder } from '@angular/forms';

@Component({
  selector: 'app-open-file',
  templateUrl: './open-file.page.html',
  styleUrls: ['./open-file.page.scss'],
})
export class OpenFilePage implements OnInit {

  form: FormGroup
  fileData: any
  fileLoaded: boolean

  constructor(
    private loadingCtrl: LoadingController,
    private translate: TranslateService,
    private walletService: WalletService,
    public metaverse: MetaverseService,
    private router: Router,
    private formBuilder: FormBuilder,
  ) { }

  async ngOnInit() {
    const loader = await this.loadingCtrl.create({
      animated: true,
      spinner: 'crescent',
      message: await this.translate.get('OPEN_FILE.LOADER').toPromise(),
    });

    this.form = this.formBuilder.group({
      passphrase: new FormControl('', [Validators.required, Validators.minLength(4)])
    });
  }

  open(e) {
    let file = e.target.files
    let reader = new FileReader();
    reader.onload = (e: any) => {
      let content = e.target.result;

      try {
        this.fileData = JSON.parse(content)
        console.log(this.fileData)
        //this.wallet.import(encryptedWallet, passphrase, this.metaverse.network);
        //this.wallet.setWallet(this.fileData).then(() => this.fileLoaded = true)
      } catch (e) {
        console.error(e);
      }
    };
    if(file[0])
      reader.readAsText(file[0]);
  }


  async decrypt(passphrase) {
    this.walletService.import(this.fileData.mnemonic, passphrase, this.metaverse.network);
    this.router.navigate(['/account']);
    /*this.showLoading()
    this.mvs.dataReset()
      .then(() => this.wallet.setSeed(password))
      .then(() => Promise.all([this.wallet.getWallet(password), this.wallet.getAddressIndex()]))
      .then((results) => this.wallet.generateAddresses(results[0], 0, results[1]))
      .then((addresses) => this.mvs.setAddresses(addresses))
      .then(() => this.wallet.saveSessionAccount(password))
      .then(() => this.nav.setRoot("LoadingPage", { reset: true }))
      .catch((e) => {
        console.error(e);
        this.showError('MESSAGE.PASSWORD_WRONG');
      });*/
  }

}
