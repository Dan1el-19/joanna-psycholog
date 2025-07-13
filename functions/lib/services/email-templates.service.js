"use strict";
/**
 * Email Templates Service
 * Manages email templates with personalization support
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailTemplatesService = void 0;
class EmailTemplatesService {
    /**
     * Get welcome email template
     */
    static getWelcomeTemplate() {
        return {
            id: 'welcome',
            name: 'Welcome Email',
            subject: 'Witamy {{firstName}} w naszej aplikacji!',
            htmlTemplate: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Witamy!</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #4a90e2; color: white; padding: 20px; text-align: center; }
            .content { padding: 30px 20px; background-color: #f9f9f9; }
            .button { 
              display: inline-block; 
              padding: 12px 24px; 
              background-color: #4a90e2; 
              color: white; 
              text-decoration: none; 
              border-radius: 5px; 
              margin: 20px 0; 
            }
            .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Witamy w naszej aplikacji!</h1>
            </div>
            <div class="content">
              <h2>Dzień dobry {{firstName}}!</h2>
              <p>Dziękujemy za rejestrację w naszej aplikacji. Cieszymy się, że do nas dołączyłeś/aś!</p>
              
              <h3>Co możesz teraz zrobić:</h3>
              <ul>
                <li>Uzupełnić swój profil</li>
                <li>Zapoznać się z naszymi usługami</li>
                <li>Umówić pierwszą wizytę</li>
              </ul>
              
              <a href="{{appUrl}}/profile" class="button">Uzupełnij profil</a>
              
              <p>Jeśli masz jakiekolwiek pytania, skontaktuj się z nami pod adresem {{supportEmail}}.</p>
              
              <p>Z poważaniem,<br>Zespół {{companyName}}</p>
            </div>
            <div class="footer">
              <p>{{companyName}} | {{companyAddress}}</p>
              <p>Ten email został wysłany na adres {{userEmail}}</p>
            </div>
          </div>
        </body>
        </html>
      `,
            textTemplate: `
        Witamy {{firstName}}!
        
        Dziękujemy za rejestrację w naszej aplikacji. Cieszymy się, że do nas dołączyłeś/aś!
        
        Co możesz teraz zrobić:
        - Uzupełnić swój profil
        - Zapoznać się z naszymi usługami  
        - Umówić pierwszą wizytę
        
        Odwiedź: {{appUrl}}/profile
        
        Jeśli masz pytania, skontaktuj się z nami: {{supportEmail}}
        
        Z poważaniem,
        Zespół {{companyName}}
      `,
            variables: ['firstName', 'userEmail', 'appUrl', 'supportEmail', 'companyName', 'companyAddress'],
            createdAt: new Date(),
            updatedAt: new Date()
        };
    }
    /**
     * Get order confirmation template
     */
    static getOrderConfirmationTemplate() {
        return {
            id: 'order-confirmation',
            name: 'Order Confirmation',
            subject: 'Potwierdzenie zamówienia #{{orderId}}',
            htmlTemplate: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Potwierdzenie zamówienia</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #28a745; color: white; padding: 20px; text-align: center; }
            .content { padding: 30px 20px; }
            .order-details { background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0; }
            .item { border-bottom: 1px solid #ddd; padding: 10px 0; }
            .total { font-weight: bold; font-size: 18px; color: #28a745; }
            .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Potwierdzenie zamówienia</h1>
            </div>
            <div class="content">
              <h2>Dzień dobry {{customerName}}!</h2>
              <p>Dziękujemy za złożenie zamówienia. Oto szczegóły:</p>
              
              <div class="order-details">
                <h3>Zamówienie #{{orderId}}</h3>
                <p><strong>Data:</strong> {{orderDate}}</p>
                <p><strong>Status:</strong> {{orderStatus}}</p>
                
                <h4>Zamówione produkty:</h4>
                {{#items}}
                <div class="item">
                  <strong>{{productName}}</strong><br>
                  Ilość: {{quantity}} | Cena: {{price}} {{currency}}
                </div>
                {{/items}}
                
                <div class="total">
                  <p>Łączna kwota: {{totalAmount}} {{currency}}</p>
                </div>
              </div>
              
              <p>Więcej szczegółów znajdziesz w panelu użytkownika: <a href="{{appUrl}}/orders/{{orderId}}">Zobacz zamówienie</a></p>
              
              <p>Z poważaniem,<br>Zespół {{companyName}}</p>
            </div>
            <div class="footer">
              <p>{{companyName}} | {{supportEmail}}</p>
            </div>
          </div>
        </body>
        </html>
      `,
            textTemplate: `
        Potwierdzenie zamówienia #{{orderId}}
        
        Dzień dobry {{customerName}}!
        
        Dziękujemy za złożenie zamówienia.
        
        Szczegóły zamówienia:
        - Numer: {{orderId}}
        - Data: {{orderDate}}
        - Status: {{orderStatus}}
        - Kwota: {{totalAmount}} {{currency}}
        
        Zobacz szczegóły: {{appUrl}}/orders/{{orderId}}
        
        Z poważaniem,
        Zespół {{companyName}}
      `,
            variables: ['customerName', 'orderId', 'orderDate', 'orderStatus', 'items', 'totalAmount', 'currency', 'appUrl', 'companyName', 'supportEmail'],
            createdAt: new Date(),
            updatedAt: new Date()
        };
    }
    /**
     * Get cart abandonment reminder template
     */
    static getCartReminderTemplate() {
        return {
            id: 'cart-reminder',
            name: 'Cart Abandonment Reminder',
            subject: 'Nie zapomnij o swoich produktach, {{customerName}}!',
            htmlTemplate: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Nie zapomnij o koszyku</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #ff6b35; color: white; padding: 20px; text-align: center; }
            .content { padding: 30px 20px; }
            .cart-items { background-color: #fff3cd; padding: 20px; border-radius: 5px; margin: 20px 0; }
            .item { border-bottom: 1px solid #ffeaa7; padding: 10px 0; }
            .button { 
              display: inline-block; 
              padding: 12px 24px; 
              background-color: #ff6b35; 
              color: white; 
              text-decoration: none; 
              border-radius: 5px; 
              margin: 20px 0; 
            }
            .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Twój koszyk czeka!</h1>
            </div>
            <div class="content">
              <h2>Dzień dobry {{customerName}}!</h2>
              <p>Zauważyliśmy, że zostawiłeś/aś produkty w koszyku. Nie chcesz ich stracić!</p>
              
              <div class="cart-items">
                <h3>Produkty w koszyku:</h3>
                {{#items}}
                <div class="item">
                  <strong>{{productName}}</strong><br>
                  Ilość: {{quantity}} | Cena: {{price}} {{currency}}
                </div>
                {{/items}}
              </div>
              
              <a href="{{checkoutUrl}}" class="button">Dokończ zakupy</a>
              
              <p>To przypomnienie {{reminderCount}} z 3. Produkty będą dostępne jeszcze przez {{daysLeft}} dni.</p>
              
              <p>Potrzebujesz pomocy? Skontaktuj się z nami: {{supportEmail}}</p>
            </div>
            <div class="footer">
              <p>{{companyName}} | Nie chcesz otrzymywać przypomnień? <a href="{{unsubscribeUrl}}">Wypisz się</a></p>
            </div>
          </div>
        </body>
        </html>
      `,
            textTemplate: `
        Twój koszyk czeka, {{customerName}}!
        
        Zauważyliśmy, że zostawiłeś/aś produkty w koszyku.
        
        Produkty w koszyku:
        {{#items}}
        - {{productName}} ({{quantity}}x {{price}} {{currency}})
        {{/items}}
        
        Dokończ zakupy: {{checkoutUrl}}
        
        To przypomnienie {{reminderCount}} z 3.
        
        Potrzebujesz pomocy? {{supportEmail}}
        
        {{companyName}}
      `,
            variables: ['customerName', 'items', 'checkoutUrl', 'reminderCount', 'daysLeft', 'supportEmail', 'companyName', 'unsubscribeUrl'],
            createdAt: new Date(),
            updatedAt: new Date()
        };
    }
    /**
     * Process template with variables
     */
    static processTemplate(template, variables) {
        let processed = template;
        // Handle simple variable substitution {{variable}}
        for (const [key, value] of Object.entries(variables)) {
            const regex = new RegExp(`{{${key}}}`, 'g');
            processed = processed.replace(regex, String(value || ''));
        }
        // Handle array iterations {{#items}} ... {{/items}}
        if (variables.items && Array.isArray(variables.items)) {
            const itemsRegex = /{{#items}}([\s\S]*?){{\/items}}/g;
            processed = processed.replace(itemsRegex, (match, itemTemplate) => {
                return variables.items.map((item) => {
                    let itemProcessed = itemTemplate;
                    for (const [key, value] of Object.entries(item)) {
                        const regex = new RegExp(`{{${key}}}`, 'g');
                        itemProcessed = itemProcessed.replace(regex, String(value || ''));
                    }
                    return itemProcessed;
                }).join('');
            });
        }
        return processed;
    }
    /**
     * Get template by ID
     */
    static getTemplate(templateId) {
        switch (templateId) {
            case 'welcome':
                return this.getWelcomeTemplate();
            case 'order-confirmation':
                return this.getOrderConfirmationTemplate();
            case 'cart-reminder':
                return this.getCartReminderTemplate();
            default:
                return null;
        }
    }
}
exports.EmailTemplatesService = EmailTemplatesService;
//# sourceMappingURL=email-templates.service.js.map