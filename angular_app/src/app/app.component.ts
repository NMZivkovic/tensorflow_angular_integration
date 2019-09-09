import { Component, OnInit, ViewChild, Input, AfterViewInit, ElementRef } from '@angular/core';

import { fromEvent } from 'rxjs';
import { switchMap, takeUntil, pairwise } from 'rxjs/operators';
import * as tf from '@tensorflow/tfjs';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit, AfterViewInit{

  @Input() public width = 400;
  @Input() public height = 400;
  @ViewChild('canvas', {static: true}) public canvas: ElementRef;

  private model;
  private context: CanvasRenderingContext2D;
  private title = ''
  private predicted = '';

  constructor(
  ) { }

  /// During initialization training of the model on the backend is initialized.
  /// After that is done model is loaded from the predefined location.
  public async ngOnInit(): Promise<void> {

    this.title = 'Started model training, please wait...';

    this.model = await tf.loadLayersModel('http://localhost:3000/model.json')
    console.log(this.model.summary());
    
    this.title = 'Model Trained! Write down digits!';
  }

  /// Used to configure canvas properties.
  public ngAfterViewInit() {
      const canvasHtmlElement: HTMLCanvasElement = this.canvas.nativeElement;
      this.context = canvasHtmlElement.getContext('2d');

      canvasHtmlElement.width = this.width;
      canvasHtmlElement.height = this.height;

      this.context.lineWidth = 11;
      this.context.lineCap = 'round';
      this.context.strokeStyle = '#111111';

      this.captureEvents(canvasHtmlElement);
  }

  /// Clears the canvas and the information on the screen.
  public clear(): void {
    this.context.clearRect(0, 0, this.context.canvas.width, this.context.canvas.height);
    this.predicted = '';
  }

  /// Captures events from the canvas.
  /// Based on the type of the event (mousedown, mouseup, etc.) performs certain actions.
  /// In charge of drawing images on canvas and runing the model predictions once digit is drawn.
  private captureEvents(canvasHtmlElement: HTMLCanvasElement) {
      // Draw image.
      fromEvent(canvasHtmlElement, 'mousedown')
      .pipe(
      switchMap((e) => {
          return fromEvent(canvasHtmlElement, 'mousemove')
          .pipe(
              takeUntil(fromEvent(canvasHtmlElement, 'mouseup')),
              takeUntil(fromEvent(canvasHtmlElement, 'mouseleave')),
              pairwise()
          )
      })
      ).subscribe((res: [MouseEvent, MouseEvent]) => {
          const clientRect = canvasHtmlElement.getBoundingClientRect();

          const previousPosition = {
            x: res[0].clientX - clientRect.left,
            y: res[0].clientY - clientRect.top
          };

          const currentPosition = {
            x: res[1].clientX - clientRect.left,
            y: res[1].clientY - clientRect.top
          };

          this.drawOnCanvas(previousPosition, currentPosition);
      });

      // Drawing is finished, run the predictions
      fromEvent(canvasHtmlElement, 'mouseup')
      .subscribe( async () => {
        const pred = await tf.tidy(() => {

          // Convert the canvas pixels to 
          let image = this.getImage(canvasHtmlElement)
          
          // Make and format the predications
          const output = this.model.predict(image) as any;
          let predictions = Array.from(output.dataSync());
          console.log(predictions);

          // Write out the prediction.
          for (let i = 0; i < predictions.length; i++) {
            if (predictions[i] == "1") {
              this.predicted = i.toString();
            }
          }
          if (this.predicted == "") {
            this.predicted = ":(";
          }
        });
      })
  }

  /// Handles drawing on the canvas.
  private drawOnCanvas(previousPosition: { x: number, y: number }, currentPosition: { x: number, y: number }) {
      if (!this.context) { return; }

      this.context.beginPath();

      if (previousPosition) {
        this.context.moveTo(previousPosition.x, previousPosition.y);
        this.context.lineTo(currentPosition.x, currentPosition.y);
        this.context.stroke();
      }
  }

  private getImage(canvasHtmlElement)
  {
    this.context.drawImage(canvasHtmlElement, 0, 0, 28, 28);
    let imageData = this.context.getImageData(0, 0, 28, 28);
    let img = tf.browser.fromPixels(imageData, 1);
    let imgtmp = img.reshape([1, 28, 28, 1]);
    imgtmp = tf.cast(imgtmp, 'float32');

    return imgtmp;
  }
}
